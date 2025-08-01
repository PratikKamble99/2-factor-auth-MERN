import passport from "passport";
import { setupJWTStrategy } from "../common/strategies/jwt.strategy";

const initializePassport = () => {
  setupJWTStrategy(passport);
};

initializePassport();

export default passport;
