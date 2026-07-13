require('dotenv').config();

const cors = require('cors');
const express = require('express');

const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const medicationRoutes = require('./routes/medication.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const notificationRouter = require('./routes/notification.routers');
const relationshipRoutes = require('./routes/relationship.routes');
const caregiverRoutes = require('./routes/caregiver.routes');

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: corsOrigin === '*' ? '*' : corsOrigin.split(',') }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/medications', medicationRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/notification',notificationRouter);
app.use('/relationships', relationshipRoutes);
app.use('/caregiver', caregiverRoutes);

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
      });
    })
    .catch((error) => {
      console.error('No fue posible iniciar TrackPill API.', error);
      process.exit(1);
    });
}

module.exports = app;
