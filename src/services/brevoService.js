const SibApiV3Sdk = require('sib-api-v3-sdk');
require('dotenv').config();

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const smsInstance = new SibApiV3Sdk.TransactionalSMSApi();

/**
 * Send Transactional Email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML body
 * @param {object} sender - Optional sender object {name, email}
 */
const sendEmail = async (to, subject, htmlContent, sender = null) => {
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;
  const defaultSenderEmail = process.env.EMAIL_FROM || "waruijohnkar@gmail.com";
  const defaultSenderName = process.env.EMAIL_FROM_NAME || "Trespics Academy";
  sendSmtpEmail.sender = sender || { name: defaultSenderName, email: defaultSenderEmail };
  sendSmtpEmail.to = [{ email: to }];

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email sent successfully:', data.messageId);
    return data;
  } catch (error) {
    console.error('Error sending email via Brevo:', error);
    throw error;
  }
};

/**
 * Send Transactional SMS
 * @param {string} to - Recipient phone (international format)
 * @param {string} content - Message content
 */
const sendSMS = async (to, content) => {
  const sendTransacSms = new SibApiV3Sdk.SendTransacSms();
  sendTransacSms.sender = "Trespics";
  sendTransacSms.recipient = to;
  sendTransacSms.content = content;

  try {
    const data = await smsInstance.sendTransacSms(sendTransacSms);
    console.log('SMS sent successfully:', data.messageId);
    return data;
  } catch (error) {
    console.error('Error sending SMS via Brevo:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendSMS
};
