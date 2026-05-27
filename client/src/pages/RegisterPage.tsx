import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRegister } from '@/hooks/useAuth';
import { extractErrorMessage } from '@/lib/api';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function validate(name: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  return errors;
}

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const register = useRegister();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const v = validate(name, email, password);
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    try {
      await register.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      navigate('/recipes', { replace: true });
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Could not create account'));
    }
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md">
      <div className="rounded-2xl border border-line bg-card p-8 shadow-soft">
        <p className="mm-eyebrow">Create your account</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-ink">
          Start eating <span className="italic text-brand-700">thoughtfully</span>
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Plan meals, track pantry, and let the assistant draft your week.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4" noValidate>
          <Input
            name="name"
            label="Full name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            placeholder="Alex Cook"
          />
          <Input
            type="email"
            name="email"
            label="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            placeholder="you@example.com"
          />
          <Input
            type="password"
            name="password"
            label="Password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            hint="At least 8 characters"
          />

          {formError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </div>
          )}

          <Button type="submit" loading={register.isPending} className="w-full">
            Create account
          </Button>
        </form>

        <p className="mt-7 text-center text-sm text-ink-soft">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
