function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

export function paymentEmailConfigurationError() {
  if (!process.env.RESEND_API_KEY)
    return "Approval emails are not configured: add RESEND_API_KEY in Vercel.";
  if (!process.env.PAYMENT_APPROVAL_FROM)
    return "Approval emails are not configured: add PAYMENT_APPROVAL_FROM in Vercel.";
  return null;
}

export async function sendPaymentApprovalEmail({ to, name, amountPaise }) {
  const configurationError = paymentEmailConfigurationError();
  if (configurationError) throw new Error(configurationError);
  if (!to) throw new Error("This account has no email address to notify.");

  const recipientName = name || "manager";
  const amount = `₹${(amountPaise / 100).toFixed(2)}`;
  const text = `Hi ${recipientName},\n\nYour ${amount} Krea Fantasy Football League entry payment has been approved by the SFL admin team. Your squad access is now enabled.\n\nThank you,\nSFL Admin Team`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#242033"><h2>Payment approved</h2><p>Hi ${escapeHtml(recipientName)},</p><p>Your <strong>${amount}</strong> Krea Fantasy Football League entry payment has been approved by the SFL admin team.</p><p>Your squad access is now enabled.</p><p>Thank you,<br>SFL Admin Team</p></div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.PAYMENT_APPROVAL_FROM,
      to: [to],
      subject: "Your SFL entry payment is approved",
      text,
      html,
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      result?.message ||
      result?.error ||
      `Resend returned HTTP ${response.status}`;
    throw new Error(String(detail).slice(0, 500));
  }
  return result;
}

export async function sendAndTrackPaymentApprovalEmail(
  admin,
  payment,
  recipient,
  retryError = null,
) {
  const configurationError = paymentEmailConfigurationError();
  if (configurationError) {
    const { error } = await admin
      .from("payments")
      .update({ approval_email_error: configurationError })
      .eq("id", payment.id)
      .eq("status", "paid")
      .is("approval_email_sent_at", null);
    if (error) {
      return {
        sent: false,
        error: `${configurationError} Could not save email status: ${error.message}`,
      };
    }
    return { sent: false, error: configurationError };
  }

  const attemptedAt = new Date().toISOString();
  let claim = admin
    .from("payments")
    .update({
      approval_email_attempted_at: attemptedAt,
      approval_email_error: null,
    })
    .eq("id", payment.id)
    .eq("status", "paid")
    .is("approval_email_sent_at", null);

  claim = retryError
    ? claim.eq("approval_email_error", retryError)
    : claim.is("approval_email_attempted_at", null);

  const { data: claimed, error: claimError } = await claim
    .select("id")
    .maybeSingle();
  if (claimError) return { sent: false, error: claimError.message };
  if (!claimed)
    return {
      sent: false,
      error: "The email was already sent or is being processed.",
    };

  try {
    await sendPaymentApprovalEmail({
      to: recipient.email || payment.submitted_email,
      name: recipient.name,
      amountPaise: payment.amount_paise,
    });
  } catch (error) {
    const message = String(
      error.message || "Could not send approval email",
    ).slice(0, 500);
    const { error: saveError } = await admin
      .from("payments")
      .update({ approval_email_error: message })
      .eq("id", payment.id)
      .eq("approval_email_attempted_at", attemptedAt);
    return {
      sent: false,
      error: saveError
        ? `${message} Could not save email status: ${saveError.message}`
        : message,
    };
  }

  const { error: saveError } = await admin
    .from("payments")
    .update({
      approval_email_sent_at: new Date().toISOString(),
      approval_email_error: null,
    })
    .eq("id", payment.id)
    .eq("approval_email_attempted_at", attemptedAt);
  if (saveError) {
    return {
      sent: true,
      error: `Email was sent, but its status could not be saved: ${saveError.message}`,
    };
  }
  return { sent: true, error: null };
}
