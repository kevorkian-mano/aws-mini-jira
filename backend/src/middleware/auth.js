const { CognitoJwtVerifier } = require("aws-jwt-verify");

console.log('POOL ID:', process.env.COGNITO_USER_POOL_ID);
console.log('CLIENT ID:', process.env.COGNITO_CLIENT_ID);

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: process.env.COGNITO_CLIENT_ID,
});

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const payload = await verifier.verify(token);
    req.user = {
      userId: payload.sub,
      email: payload.email,
      role: payload["custom:role"] || "employee",
      teamId: payload["custom:teamId"] || null,
      teamName: payload["custom:teamName"] || null,
    };
    next();
  } catch (err) {
    console.error('JWT ERROR:', err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const requireManager = (req, res, next) => {
  if (req.user.role !== "manager") {
    return res.status(403).json({ error: "Manager access required" });
  }
  next();
};

module.exports = { authenticate, requireManager };
