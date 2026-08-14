import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { UserResponseDto } from 'src/modules/auth/dto/user-response.dto';
import { UserEntity } from 'src/modules/auth/entities/user.entity';
import { PrismaService } from 'src/prisma/prisma.service';
import { EditProfileDto } from './dto/edit-profile.dto';
import { MeErrorCode } from './errors/me-error.code.enum';

interface UserUpdateData {
  name?: string;
  username?: string;
  username_lower?: string;
}

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async editProfile(
    user: UserEntity,
    dto: EditProfileDto,
  ): Promise<UserResponseDto> {
    if (dto.name === undefined && dto.username === undefined) {
      throw new BadRequestException({
        error_code: MeErrorCode.EMPTY_UPDATE_PAYLOAD,
      });
    }

    const updateData: UserUpdateData = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    if (dto.username !== undefined) {
      const lower = dto.username.toLowerCase();
      if (lower !== user.username_lower) {
        const existing = await this.prisma.user.findUnique({
          where: { username_lower: lower },
        });

        if (existing && existing.id !== user.id) {
          throw new ConflictException({
            error_code: MeErrorCode.USERNAME_ALREADY_TAKEN,
          });
        }
      }

      updateData.username = dto.username;
      updateData.username_lower = lower;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return {
      id: updatedUser.id,
      username: updatedUser.username,
      name: updatedUser.name,
      avatar: updatedUser.avatar,
    };
  }
}
