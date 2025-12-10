const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { Strategy: JwtStrategy } = require("passport-jwt");
const User = require("../../infrastructure/database/models/user.model");
const userService = require("../../../Facades/services/users");

const GOOGLE_SCOPES = ["profile", "email"];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await userService.findOrCreateGoogleUser(profile);
          return done(null, user);
        } catch (error) {
          console.error("Google authentication error:", error);
          return done(error);
        }
      },
    ),
  );
} else {
  console.warn(
    "[passport] GOOGLE_CLIENT_ID/SECRET not set. Google login will be disabled.",
  );
}

const cookieExtractor = (req) => {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies.token;
  }
  return token;
};

const jwtOptions = {
  jwtFromRequest: cookieExtractor,
  secretOrKey: process.env.JWT_SECRET,
};

passport.use(
  new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
    try {
      const user = await User.findByPk(jwtPayload.id);
      if (user) return done(null, user);
      return done(null, false);
    } catch (err) {
      return done(err, false);
    }
  }),
);

module.exports = {
  GOOGLE_SCOPES,
};
