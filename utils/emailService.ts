// Email service stub - OTP is now logged to console instead
// This file is kept for backward compatibility but not actively used

interface SendOtpEmailParams {
    email: string;
    otp: string;
    userName?: string;
}

export async function sendOtpEmail({ email, otp, userName = "User" }: SendOtpEmailParams) {
    console.log(`[OTP] Verification code for ${email}: ${otp}`);
    return { success: true };
}
