import nodemailer from "nodemailer";

interface SendOtpEmailParams {
    email: string;
    otp: string;
    userName?: string;
}

function getRequiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`${name} is not configured`);
    }

    return value;
}

function getSmtpSecureFlag(): boolean {
    const value = process.env.SMTP_SECURE;

    if (!value) {
        return true;
    }

    return value.toLowerCase() === "true";
}

export async function sendOtpEmail({ email, otp, userName = "User" }: SendOtpEmailParams) {
    try {
        const smtpHost = getRequiredEnv("SMTP_HOST");
        const smtpPort = Number(getRequiredEnv("SMTP_PORT"));
        const smtpUser = getRequiredEnv("SMTP_USER");
        const smtpPass = getRequiredEnv("SMTP_PASS");
        const senderEmail = getRequiredEnv("SMTP_FROM");
        const smtpSecure = getSmtpSecureFlag();

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        const response = await transporter.sendMail({
            from: senderEmail,
            to: email,
            subject: "Email Verification - Scentra",
            html: generateOtpEmailTemplate(otp, userName),
        });

        console.log(`[EMAIL] OTP sent successfully to ${email}`);
        return response;
    } catch (error) {
        const err = error as any;
        const errorCode = err?.code || "UNKNOWN";
        const errorMessage = err?.message || String(error);

        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.error("[EMAIL ERROR] Failed to send OTP email");
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.error(`Recipient Email: ${email}`);
        console.error(`Error Code: ${errorCode}`);
        console.error(`Error Message: ${errorMessage}`);
        console.error(`SMTP Config: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} (secure=${process.env.SMTP_SECURE})`);
        console.error(`SMTP User: ${process.env.SMTP_USER}`);

        // Provide helpful debugging hints based on error code
        if (errorCode === "ETIMEDOUT" || errorCode === "ECONNREFUSED") {
            console.error("\n💡 Troubleshooting SMTP Connection:");
            console.error("  • Check SMTP_HOST and SMTP_PORT are correct");
            console.error("  • Verify SMTP_SECURE matches your SMTP provider (465 = true, 587 = false)");
            console.error("  • Ensure firewall/network allows outbound connections to SMTP server");
            console.error("  • For Gmail: verify app password is correct (not your main password)");
        } else if (errorCode === "EAUTH") {
            console.error("\n💡 Authentication Failed:");
            console.error("  • Check SMTP_USER and SMTP_PASS are correct");
            console.error("  • For Gmail: use app password, not your account password");
            console.error("  • Verify credentials have not expired");
        } else if (errorCode === "ENOTFOUND") {
            console.error("\n💡 SMTP Server Not Found:");
            console.error("  • Verify SMTP_HOST is spelled correctly");
            console.error("  • Check DNS resolution is working");
        }
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

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
