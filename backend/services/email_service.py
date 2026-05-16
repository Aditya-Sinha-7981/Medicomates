import logging
from urllib.parse import quote

import resend

from config import settings

logger = logging.getLogger(__name__)

resend.api_key = settings.RESEND_API_KEY


def build_reminder_email(medicine_name: str, dosage: str, token: str) -> str:
    # Must encode token: urlsafe tokens can include +, &, etc.; mail clients rewrite bare query values.
    confirm_url = f"{settings.BACKEND_URL}/api/adherence/confirm?token={quote(str(token), safe='')}"
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
      <div style="max-width: 480px; margin: auto; background: white; border-radius: 12px; padding: 32px;">
        <h2 style="color: #1a73e8;">💊 Medicine Reminder</h2>
        <p style="font-size: 18px;">Time to take your <strong>{medicine_name} {dosage}</strong></p>
        <a href="{confirm_url}"
           style="display:inline-block; margin-top:20px; padding: 16px 32px;
                  background:#1a73e8; color:white; border-radius:8px;
                  text-decoration:none; font-size:18px;">
          ✅ Yes, I took it
        </a>
        <p style="color:#999; margin-top:24px; font-size:13px;">
          If you did not take it, ignore this email. It will be marked as missed automatically.
        </p>
      </div>
    </body>
    </html>
    """


def send_reminder_email(to: str, medicine_name: str, dosage: str, token: str) -> None:
    html_content = build_reminder_email(medicine_name, dosage, token)
    try:
        response = resend.Emails.send(
            {
                "from": settings.FROM_EMAIL,
                "to": to,
                "subject": f"Time to take your {medicine_name}",
                "html": html_content,
            }
        )
        logger.info(
            "Resend reminder sent medicine=%s to=%s response=%s",
            medicine_name,
            to,
            response,
        )
    except Exception:
        logger.exception("Resend reminder failed to=%s", to)


def build_sos_reviewer_email(patient_name: str, triggered_at_display: str) -> str:
    name = (patient_name or "Patient").strip()
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #fef2f2; padding: 20px;">
      <div style="max-width: 480px; margin: auto; background: white; border-radius: 12px; padding: 32px; border: 2px solid #dc2626;">
        <h2 style="color: #dc2626; margin-top: 0;">EMERGENCY SOS</h2>
        <p style="font-size: 18px; color: #1e293b;">
          <strong>{name}</strong> has triggered an emergency SOS alert.
        </p>
        <p style="font-size: 15px; color: #475569;">
          Time: <strong>{triggered_at_display}</strong>
        </p>
        <p style="font-size: 15px; color: #475569; margin-top: 20px;">
          Please check on them immediately and contact their care team if needed.
        </p>
        <p style="color:#94a3b8; margin-top:24px; font-size:13px;">
          This is an automated emergency notification from Medicomates.
        </p>
      </div>
    </body>
    </html>
    """


def send_sos_alert_email(to: str, patient_name: str, triggered_at_display: str) -> bool:
    """Send emergency SOS email (reviewers and connected doctors)."""
    html_content = build_sos_reviewer_email(patient_name, triggered_at_display)
    try:
        response = resend.Emails.send(
            {
                "from": settings.FROM_EMAIL,
                "to": to,
                "subject": f"EMERGENCY SOS — {patient_name}",
                "html": html_content,
            }
        )
        logger.info(
            "Resend SOS alert sent patient=%s to=%s response=%s",
            patient_name,
            to,
            response,
        )
        return True
    except Exception:
        logger.exception("Resend SOS alert failed to=%s", to)
        return False


# Backwards-compatible alias
send_sos_reviewer_email = send_sos_alert_email
