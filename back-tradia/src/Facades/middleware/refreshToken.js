const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    const expiresIn = decoded.exp * 1000 - Date.now();

    if (expiresIn < 15 * 60 * 1000) {
      try {
        const newToken = jwt.sign(
          { 
            id: decoded.id,
            username: decoded.username,
            timestamp: new Date().toISOString()
          }, 
          process.env.JWT_SECRET, 
          {
            expiresIn: "1h",
          }
        );

        res.cookie("token", newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: "Lax",
          maxAge: 3600000,
          path: "/",
        });

        const newDecoded = jwt.verify(newToken, process.env.JWT_SECRET);
        req.user = newDecoded;

        console.log(`[${new Date().toISOString()}] Token renovado para usuario ${decoded.id}`);
      } catch (refreshError) {
        console.error(`[${new Date().toISOString()}] Error al generar nuevo token:`, refreshError);
      }
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.error(`[${new Date().toISOString()}] Token expirado para la solicitud a ${req.originalUrl}`);
      
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: "Lax",
        path: "/",
      });
    } else {
      console.error(`[${new Date().toISOString()}] Error de verificación de token:`, {
        error: error.message,
        path: req.path,
        method: req.method
      });
    }
  }

  next();
};

const protectRoute = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Acceso no autorizado. Por favor, inicie sesión.",
      code: "UNAUTHORIZED"
    });
  }
  next();
};

module.exports.protectRoute = protectRoute;
