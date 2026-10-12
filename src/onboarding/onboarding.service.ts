import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoles } from '../auth/enums';
import { User } from '../user/entities/user.entity';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';

const ROLE_STEPS: Record<UserRoles, readonly string[]> = {
  [UserRoles.Estudiante]: ['security', 'courses', 'submission', 'help'],
  [UserRoles.Docente]: ['security', 'course', 'rubric', 'assignment', 'review'],
  [UserRoles.Administrador]: ['security', 'approvals', 'courses', 'operations', 'feedback'],
};

@Injectable()
export class OnboardingService {
  constructor(@InjectRepository(User) private readonly userRepository: Repository<User>) {}

  get(user: User) {
    const allowedSteps = [...ROLE_STEPS[user.role]];
    return {
      role: user.role,
      allowedSteps,
      completedSteps: (user.onboardingCompletedSteps ?? []).filter((step) =>
        allowedSteps.includes(step)
      ),
      dismissedAt: user.onboardingDismissedAt ?? null,
    };
  }

  async update(user: User, input: UpdateOnboardingDto) {
    if (input.stepId === undefined && input.dismissed === undefined) {
      throw new BadRequestException('Debes indicar un paso o actualizar el estado de la guía.');
    }
    if (input.stepId !== undefined && input.completed === undefined) {
      throw new BadRequestException('Debes indicar si el paso está completado.');
    }

    const allowedSteps = ROLE_STEPS[user.role];
    if (input.stepId && !allowedSteps.includes(input.stepId)) {
      throw new BadRequestException('El paso no pertenece a la guía de este perfil.');
    }

    const completed = new Set(
      (user.onboardingCompletedSteps ?? []).filter((step) => allowedSteps.includes(step))
    );
    if (input.stepId) {
      if (input.completed) completed.add(input.stepId);
      else completed.delete(input.stepId);
    }

    user.onboardingCompletedSteps = [...completed];
    if (input.dismissed !== undefined) {
      user.onboardingDismissedAt = input.dismissed ? new Date() : null;
    }
    await this.userRepository.update(user.id, {
      onboardingCompletedSteps: user.onboardingCompletedSteps,
      onboardingDismissedAt: user.onboardingDismissedAt,
    });
    return this.get(user);
  }
}
