import axios from 'axios';
import { getTenantAccessToken } from '../utils/token.js';
import { chatWithGpt } from '../utils/openai.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { type, challenge, event } = req.body;

  // 飞书URL验证
  if (type === 'url_verification') {
    return res.status(200).json({ challenge });
  }

  if (type !== 'event_callback' || !event?.message) {
    console.log('Received non-message event or invalid format, ignoring.');
    return res.status(200).send('ok');
  }

  const msg = event.message;
  const chatId = msg.chat_id;

  let userText = '';
  try {
    userText = JSON.parse(msg.content).text;
  } catch {
    userText = '[Failed to parse message content]';
  }

  console.log('Received message:', userText);

  const replyText = await chatWithGpt(userText);

  let tenantToken;
  try {
    tenantToken = await getTenantAccessToken();
  } catch (err) {
    console.error('Failed to get tenant access token:', err);
    return res.status(500).send('Internal Server Error');
  }

  try {
    const resp = await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/messages',
      {
        receive_id_type: 'chat_id',
        receive_id: chatId,
        msg_type: 'text',
        content: { text: replyText },
      },
      {
        headers: {
          Authorization: `Bearer ${tenantToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (resp.data.code === 0) {
      console.log('Message sent successfully');
    } else {
      console.error('Failed to send message:', resp.data);
    }
  } catch (err) {
    console.error('Error sending message to Feishu:', err.response?.data || err.message);
  }

  return res.status(200).send('ok');
}
