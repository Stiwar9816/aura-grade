import { validate } from 'class-validator';
import { LoginUserDto } from 'src/auth/dto/login-user.dto';

describe('LoginUserDto', () => {
  let loginUserDto: LoginUserDto;

  beforeEach(() => {
    loginUserDto = new LoginUserDto();
    loginUserDto.email = 'john.doe@example.com';
    loginUserDto.password = 'Password123';
  });

  it('should pass validation with valid data', async () => {
    const errors = await validate(loginUserDto);
    expect(errors.length).toBe(0);
  });

  describe('email validation', () => {
    it('should fail if email is invalid', async () => {
      loginUserDto.email = 'invalid-email';
      const errors = await validate(loginUserDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('should fail if email is missing @', async () => {
      loginUserDto.email = 'invalidemail.com';
      const errors = await validate(loginUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail if email is empty', async () => {
      loginUserDto.email = '';
      const errors = await validate(loginUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with valid email formats', async () => {
      const validEmails = ['test@example.com', 'user.name@example.com', 'user+tag@example.co.uk'];

      for (const email of validEmails) {
        loginUserDto.email = email;
        const errors = await validate(loginUserDto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('password validation', () => {
    it('should fail if password is too short', async () => {
      loginUserDto.password = 'Abc1';
      const errors = await validate(loginUserDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should fail if password is too long', async () => {
      loginUserDto.password = 'A'.repeat(31) + 'bc123';
      const errors = await validate(loginUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail if password has no uppercase letter', async () => {
      loginUserDto.password = 'password123';
      const errors = await validate(loginUserDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should fail if password has no lowercase letter', async () => {
      loginUserDto.password = 'PASSWORD123';
      const errors = await validate(loginUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail if password has no number or special character', async () => {
      loginUserDto.password = 'PasswordOnly';
      const errors = await validate(loginUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail if password is empty', async () => {
      loginUserDto.password = '';
      const errors = await validate(loginUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with valid password formats', async () => {
      const validPasswords = ['Password123', 'MyP@ssw0rd', 'Secure123!', 'Test@123'];

      for (const password of validPasswords) {
        loginUserDto.password = password;
        const errors = await validate(loginUserDto);
        expect(errors.length).toBe(0);
      }
    });
  });
});
