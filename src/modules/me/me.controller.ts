import { Body, Controller, Patch } from '@nestjs/common';
import { AuthRequired } from 'src/modules/auth/decorators/auth-required.decorator';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { UserResponseDto } from 'src/modules/auth/dto/user-response.dto';
import { UserEntity } from 'src/modules/auth/entities/user.entity';
import { EditProfileDto } from './dto/edit-profile.dto';
import { MeService } from './me.service';

@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Patch()
  @AuthRequired()
  async editProfile(
    @CurrentUser() user: UserEntity,
    @Body() dto: EditProfileDto,
  ): Promise<UserResponseDto> {
    return await this.meService.editProfile(user, dto);
  }
}
