import type { Env } from '../types';

export async function sendVerificationEmail(
  env: Env,
  workerBaseUrl: string,
  email: string,
  name: string,
  token: string
): Promise<void> {
  const verifyUrl = `${workerBaseUrl}/auth/verify-email?token=${token}`;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác nhận email DesGen AI Pro</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">DesignGen Pro</h1>
  </div>
  
  <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h2 style="color: #333; margin-top: 0;">Xin chào ${name}!</h2>
    
    <p style="color: #666; font-size: 16px;">
      Cảm ơn bạn đã đăng ký tài khoản DesignGen Pro. Để hoàn tất đăng ký, vui lòng xác nhận email của bạn bằng cách nhấp vào nút bên dưới:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" 
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
        Xác nhận email
      </a>
    </div>
    
    <p style="color: #999; font-size: 14px; margin-top: 30px;">
      Hoặc copy và paste link sau vào trình duyệt:<br>
      <a href="${verifyUrl}" style="color: #667eea; word-break: break-all;">${verifyUrl}</a>
    </p>
    
    <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
      Link này sẽ hết hạn sau 30 phút. Nếu bạn không yêu cầu đăng ký tài khoản này, vui lòng bỏ qua email này.
    </p>
  </div>
</body>
</html>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'DesGen AI <onboarding@resend.dev>',
      to: [email],
      subject: 'Xác nhận email DesGen AI Pro',
      html: emailHtml,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to send email: ${errorData.error || response.statusText}`);
  }
}

