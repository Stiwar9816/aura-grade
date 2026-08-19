import { validate } from 'class-validator';
import { VerifyOtpDto } from 'src/auth/dto';

describe('VerifyOtpDto', () => {
  it('accepts an opaque challenge and exactly six digits', async () => {
    const input = new VerifyOtpDto();
    input.challengeToken = 'challenge-token-with-at-least-32-characters';
    input.otp = '123456';

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it.each(['12345', '1234567', '12a456'])('rejects invalid OTP value %s', async (otp) => {
    const input = new VerifyOtpDto();
    input.challengeToken = 'challenge-token-with-at-least-32-characters';
    input.otp = otp;

    const errors = await validate(input);
    expect(errors.some((error) => error.property === 'otp')).toBe(true);
  });
});
