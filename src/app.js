require('dotenv').config();

const cors = require('cors');
const express = require('express');

const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const medicineRoutes = require('./routes/medicine.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const notificationRouter = require('./routes/notification.routes');
const relationshipRoutes = require('./routes/relationship.routes');
const caregiverRoutes = require('./routes/caregiver.routes');
const profileRoutes = require('./routes/profile.routes');
const activeMedications = require('./routes/activeMedications.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const paymentRoutes = require('./routes/payment.routes');
const savedListRoutes = require('./routes/saved-list.routes');
const pharmacySearchRoutes = require('./routes/pharmacy-search.routes');
const chatbotRoutes = require('./routes/chatbot.routes');
const { startScheduledJobs } = require('./jobs/scheduler');

const app = express();
app.set('trust proxy', 1);

const corsOrigin = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: corsOrigin === '*' ? '*' : corsOrigin.split(',') }));
// Limite elevado respecto al original (1mb) para admitir fotos en base64
// enviadas al chatbot (Tuchi IA con vision real via Bedrock).
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/medicines', medicineRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/notifications', notificationRouter);
app.use('/relationships', relationshipRoutes);
app.use('/caregivers', caregiverRoutes);
app.use('/profile', profileRoutes);
app.use('/medications', activeMedications);
app.use('/subscription', subscriptionRoutes);
app.use('/payments', paymentRoutes);
app.use('/medicine-lists', savedListRoutes);
app.use('/pharmacies', pharmacySearchRoutes);
app.use('/chatbot', chatbotRoutes);

app.use((req, res) => {
  res.status(404).json({
    code: 'route_not_found',
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    success: false,
  });
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    code: error.code || 'internal_server_error',
    details: error.details,
    message: error.message || 'Error interno del servidor.',
    success: false,
  });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;

  connectDB()
    .then(() => {
      app.listen(port, () => {
        console.log(`TrackPill API escuchando en puerto ${port}`);
        startScheduledJobs();
      });
    })
    .catch((error) => {
      console.error('No fue posible iniciar TrackPill API.', error);
      process.exit(1);
    });
}

module.exports = app;
