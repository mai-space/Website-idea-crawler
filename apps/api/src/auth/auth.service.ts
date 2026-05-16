import { Injectable, UnauthorizedException, ConflictException, Logger, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    this.logger.debug(`Login attempt for email: ${dto.email}`);
    let user: { id: string; email: string; orgId: string; role: string; passwordHash: string } | null;
    try {
      user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    } catch (err: unknown) {
      this.logger.error(`DB error during login lookup for ${dto.email}: ${err instanceof Error ? err.message : String(err)}`);
      throw new InternalServerErrorException('Login failed');
    }
    if (!user) {
      this.logger.debug(`Login failed — unknown email: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    let valid: boolean;
    try {
      valid = await bcrypt.compare(dto.password, user.passwordHash);
    } catch (err: unknown) {
      this.logger.error(`bcrypt compare failed for user ${user.id}: ${err instanceof Error ? err.message : String(err)}`);
      throw new InternalServerErrorException('Login failed');
    }
    if (!valid) {
      this.logger.debug(`Login failed — wrong password for user ${user.id}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`User ${user.id} logged in successfully`);
    return this.sign(user);
  }

  async register(dto: RegisterDto) {
    this.logger.debug(`Registration attempt for email: ${dto.email}, org: ${dto.orgName}`);
    let exists: { id: string } | null;
    try {
      exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    } catch (err: unknown) {
      this.logger.error(`DB error checking existing email ${dto.email}: ${err instanceof Error ? err.message : String(err)}`);
      throw new InternalServerErrorException('Registration failed');
    }
    if (exists) throw new ConflictException('Email already in use');

    let org: { id: string };
    let user: { id: string; email: string; orgId: string; role: string; passwordHash: string };
    try {
      org = await this.prisma.organization.create({
        data: { name: dto.orgName },
      });

      user = await this.prisma.user.create({
        data: {
          orgId: org.id,
          email: dto.email,
          passwordHash: await bcrypt.hash(dto.password, 10),
          name: dto.name,
          role: 'admin',
        },
      });
    } catch (err: unknown) {
      this.logger.error(`DB error during registration for ${dto.email}: ${err instanceof Error ? err.message : String(err)}`);
      throw new InternalServerErrorException('Registration failed');
    }

    this.logger.log(`New user ${user.id} registered (org: ${org.id})`);
    return this.sign(user);
  }

  async me(userId: string) {
    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: { organization: true },
      });
      const { passwordHash: _, ...safe } = user;
      return safe;
    } catch (err: unknown) {
      this.logger.error(`Failed to load profile for user ${userId}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  private sign(user: { id: string; email: string; orgId: string; role: string }) {
    const payload = { sub: user.id, email: user.email, orgId: user.orgId, role: user.role };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, orgId: user.orgId, role: user.role },
    };
  }
}
