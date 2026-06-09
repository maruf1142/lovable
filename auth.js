export default function handler(req, res) {
  if (req.method === 'POST') {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (password === adminPassword) {
      res.status(200).json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid password' });
    }
  }
}
