// Jest global setup — runs before each test file
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test_secret_at_least_16_chars_long';
process.env.MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/mealmate-test';
