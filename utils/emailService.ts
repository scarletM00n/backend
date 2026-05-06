import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendOtpEmailParams {
    email: string;
    otp: string;
    userName?: string;
}

export async function sendOtpEmail({ email, otp, userName = "User" }: SendOtpEmailParams) {
    try {
        // Validate required environment variables
        if (!process.env.RESEND_API_KEY) {
            throw new Error("RESEND_API_KEY is not configured");
        }

        if (!process.env.SENDER_EMAIL) {
            throw new Error("SENDER_EMAIL is not configured");
        }

        const senderEmail = process.env.SENDER_EMAIL;

        const response = await resend.emails.send({
            from: senderEmail,
            to: email,
            subject: "Email Verification - Scentra",
            html: generateOtpEmailTemplate(otp, userName),
        });

        if (response.error) {
            throw new Error(`Failed to send email: ${response.error.message}`);
        }

        console.log(`[EMAIL] OTP sent successfully to ${email}`);
        return response;
    } catch (error) {
        console.error(`[EMAIL ERROR] Failed to send OTP email to ${email}:`, error);
        throw error;
    }
}

function generateOtpEmailTemplate(otp: string, userName: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f9f9f9;
            }
            .header {
                background-color: #2563eb;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 8px 8px 0 0;
            }
            .content {
                background-color: white;
                padding: 30px 20px;
                border-radius: 0 0 8px 8px;
            }
            .otp-box {
                background-color: #f0f0f0;
                border: 2px solid #2563eb;
                padding: 20px;
                text-align: center;
                border-radius: 8px;
                margin: 20px 0;
            }
            .otp-code {
                font-size: 32px;
                font-weight: bold;
                color: #2563eb;
                letter-spacing: 3px;
                font-family: 'Courier New', monospace;
            }
            .expiry {
                color: #666;
                font-size: 14px;
                margin-top: 15px;
                text-align: center;
            }
            .footer {
                color: #999;
                font-size: 12px;
                margin-top: 20px;
                text-align: center;
                padding-top: 20px;
                border-top: 1px solid #eee;
            }
            .warning {
                background-color: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
                color: #856404;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Scentra Email Verification</h1>
            </div>
            <div class="content">
                <p>Hello ${userName},</p>
                
                <p>Thank you for signing up with Scentra! To complete your email verification, please use the code below:</p>
                
                <div class="otp-box">
                    <div class="otp-code">${otp}</div>
                </div>
                
                <div class="warning">
                    <strong>⚠️ Never share this code with anyone.</strong> Scentra support will never ask for this code.
                </div>
                
                <p>This verification code is valid for <strong>10 minutes</strong>.</p>
                
                <p>If you didn't request this verification, please ignore this email.</p>
                
                <div class="footer">
                    <p>&copy; 2026 Scentra. All rights reserved.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}
