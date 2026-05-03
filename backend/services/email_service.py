import logging

import resend

from config import settings

logger = logging.getLogger(__name__)

resend.api_key = settings.RESEND_API_KEY


def build_reminder_email(medicine_name: str, dosage: str, token: str) -> str:
    confirm_url = f"{settings.BACKEND_URL}/api/adherence/confirm?token={token}"
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
