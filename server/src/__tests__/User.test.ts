import { connectInMemoryDB, clearDB, disconnectInMemoryDB } from '../test/db';
import { User } from '../models/User';

beforeAll(async () => {
  await connectInMemoryDB();
  await User.syncIndexes();
});

afterEach(async () => {
  await clearDB();
});

afterAll(async () => {
  await disconnectInMemoryDB();
});

describe('User model', () => {
  it('hashes the password on save', async () => {
    const user = await User.create({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'plaintext123',
    });
    const reloaded = await User.findById(user._id).select('+password');
    expect(reloaded?.password).not.toBe('plaintext123');
    expect(reloaded?.password.startsWith('$2')).toBe(true);
  });

  it('comparePassword works for valid + invalid passwords', async () => {
    await User.create({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'mypassword1',
    });
    const user = await User.findOne({ email: 'bob@example.com' }).select('+password');
    expect(await user!.comparePassword('mypassword1')).toBe(true);
    expect(await user!.comparePassword('wrongpass')).toBe(false);
  });

  it('rejects invalid email', async () => {
    await expect(
      User.create({ name: 'X', email: 'not-an-email', password: 'longenough' })
    ).rejects.toThrow();
  });

  it('rejects short password', async () => {
    await expect(
      User.create({ name: 'X', email: 'x@y.com', password: 'short' })
    ).rejects.toThrow();
  });

  it('enforces unique email', async () => {
    await User.create({ name: 'Alpha', email: 'dup@x.com', password: 'longenough' });
    await expect(
      User.create({ name: 'Bravo', email: 'dup@x.com', password: 'longenough' })
    ).rejects.toThrow();
  });

  it('does not return password in toJSON', async () => {
    const user = await User.create({
      name: 'Carol',
      email: 'c@x.com',
      password: 'longenough',
    });
    const json = user.toJSON();
    expect(json).not.toHaveProperty('password');
    expect(json).toHaveProperty('id');
  });
});
