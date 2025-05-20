import fetch from 'node-fetch';
import { Configuration, OpenAIApi } from 'openai';

const OPENAI_API_KEY = 'your-openai-api-key'; // 填写你的 OpenAI API 密钥
const FEISHU_APP_ID = 'your-feishu-app-id'; // 填写你的飞书应用 ID
const FEISHU_APP_SECRET = 'your-feishu-app-secret'; // 填写你的飞书应用密钥

// 获取飞书 token
let cachedToken = null;
let expireTime = 0;

async function getTenantAccessToken() {
  const now = Date.now();
  if (cachedToken && now < expireTime) {
    return cachedToken;
  }

  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`获取token失败: ${data.msg}`);
  }
  
  cachedToken = data.tenant_access_token;
  expireTime = now + (data.expire - 60) * 1000; // 提前60秒刷新
  return cachedToken;
}

// OpenAI GPT 配置
const openai = new OpenAIApi(new Configuration({
  apiKey: OPENAI_API_KEY,
}));

async function chatWithGpt(message) {
  const response = await openai.createCompletion({
    model: "gpt-3.5-turbo", // 或者 "gpt-4" 看你所使用的计划
    messages: [{ role: 'user', content: message }],
  });

  return response.data.choices[0].message.content;
}

// 飞书事件处理
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { type, challenge, event } = req.body;

  // 飞书事件订阅验证
  if (type === 'url_verification' && challenge) {
    return res.status(200).json({ challenge });
  }

  // 消息事件处理
  if (type === 'event_callback' && event && event.message) {
    const msg = event.message;
    const chatId = msg.chat_id;
    const messageText = JSON.parse(msg.content).text;

    console.log('收到消息:', messageText, 'from chat_id:', chatId);

    // 使用 GPT 生成回复内容
    const replyText = await chatWithGpt(messageText);

    // 获取飞书 token
    let token = '';
    try {
      token = await getTenantAccessToken();
    } catch (err) {
      console.error('获取飞书token失败:', err);
      return res.status(500).send('获取token失败');
    }

    const payload = {
      receive_id_type: 'chat_id',
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text: replyText }),
    };

    try {
      const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      if (!response.ok) {
        console.error('飞书发送消息失败，状态码:', response.status, '响应:', text);
      } else {
        console.log('飞书发送消息成功:', text);
      }
    } catch (err) {
      console.error('飞书发送消息异常:', err);
    }

    return res.status(200).send('ok');
  }

  console.log('收到非消息事件或事件格式异常，忽略');
  return res.status(200).send('ok');
}
