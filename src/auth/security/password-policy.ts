import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

const BLOCKED_PASSWORDS = new Set(
  [
    '123456789012345',
    'administrador123',
    'administrador123!',
    'aura grade 12345',
    'auragrade123456',
    'contraseña123456',
    'password123456',
    'password123456!',
    'qwerty123456789',
    'welcome12345678',
  ].map((password) => password.normalize('NFC').toLocaleLowerCase())
);

export const normalizePassword = (password: string): string => password.normalize('NFC');

export const passwordPolicyError = (password: unknown): string | null => {
  if (typeof password !== 'string') return 'La contraseña debe ser un texto.';
  const normalized = normalizePassword(password);
  if (/\s/u.test(normalized))
    return 'La contraseña no puede contener espacios ni otros caracteres en blanco.';
  const length = Array.from(normalized).length;
  if (length < PASSWORD_MIN_LENGTH)
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (length > PASSWORD_MAX_LENGTH)
    return `La contraseña no puede superar ${PASSWORD_MAX_LENGTH} caracteres.`;
  if (BLOCKED_PASSWORDS.has(normalized.toLocaleLowerCase()))
    return 'La contraseña es demasiado común. Usa una frase más larga y única.';
  return null;
};

@ValidatorConstraint({ name: 'strongPassword', async: false })
export class StrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return passwordPolicyError(value) === null;
  }

  defaultMessage(arguments_: ValidationArguments): string {
    return passwordPolicyError(arguments_.value) ?? 'La contraseña no cumple la política.';
  }
}

export const IsStrongPassword =
  (validationOptions?: ValidationOptions) =>
  (object: object, propertyName: string): void => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: StrongPasswordConstraint,
    });
  };
