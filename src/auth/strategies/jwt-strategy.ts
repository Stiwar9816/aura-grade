// NestJS
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Passport
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
// TypeORM
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// Entities
import { User } from '../../user/entities/user.entity';
// Interfaces
import { JwtPayload } from '../interface/jwt-payload.interface';
import { hasAcademicAccess } from '../../academic-access/academic-access.policy';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    configService: ConfigService
  ) {
    super({
      secretOrKey: configService.get('JWT_SECRET'),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  // validate if the user has a required token
  async validate(payload: JwtPayload): Promise<User> {
    const { id } = payload;
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['institution'],
    });
    if (!user) throw new UnauthorizedException('El token no es válido.');
    if (!hasAcademicAccess(user))
      throw new UnauthorizedException('El usuario está inactivo. Comunícate con un administrador.');

    delete user.password;

    return user;
  }
}
