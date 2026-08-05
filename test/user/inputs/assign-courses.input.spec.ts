import { validate } from 'class-validator';
import { AssignCoursesInput } from 'src/user/dto';

describe('AssignCoursesInput', () => {
  const userId = '123e4567-e89b-42d3-a456-426614174000';
  const courseId = 'b8a98148-5341-4d8e-a968-d4601ec38522';

  it('accepts unique user and course UUIDs', async () => {
    const input = new AssignCoursesInput();
    input.userId = userId;
    input.courseIds = [courseId];

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('rejects duplicated course IDs', async () => {
    const input = new AssignCoursesInput();
    input.userId = userId;
    input.courseIds = [courseId, courseId];

    const errors = await validate(input);

    expect(errors.some((error) => error.property === 'courseIds')).toBe(true);
  });
});
