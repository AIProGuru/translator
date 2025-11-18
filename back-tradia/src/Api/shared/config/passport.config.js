const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../../infrastructure/database/models/user.model");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");

passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			callbackURL: process.env.GOOGLE_CALLBACK_URL,
		},
		async (accessToken, refreshToken, profile, done) => {
			try {
				let user = await User.findOne({
					where: { googleId: profile.id },
				});

				if (!user) {
					user = await User.create({
						googleId: profile.id,
						displayName: profile.displayName,
						email: profile.emails[0].value,
						photo: profile.photos[0].value,
					});
				}

				return done(null, user);
			} catch (err) {
				console.error("Error al configurar el passport:", err);
				return done(err, null);
			}
		}
	)
);

const cookieExtractor = (req) => {
	let token = null;
	if (req && req.cookies) {
		token = req.cookies["token"];
	}
	return token;
};

const jwtOptions = {
	jwtFromRequest: cookieExtractor,
	secretOrKey: process.env.JWT_SECRET,
};

passport.use(
	new JwtStrategy(jwtOptions, async (jwt_payload, done) => {
		try {
			const user = await User.findByPk(jwt_payload.id);
			if (user) return done(null, user);
			else return done(null, false);
		} catch (err) {
			return done(err, false);
		}
	})
);
