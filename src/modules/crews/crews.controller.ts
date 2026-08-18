import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaginatedResponseDto } from 'src/common/dto/pagination/paginated-response.dto';
import { AuthRequired } from 'src/modules/auth/decorators/auth-required.decorator';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { CrewsService } from './crews.service';
import { CreateCrewDto } from './dto/create-crew.dto';
import { CrewDetailResponseDto } from './dto/crew-detail-response.dto';
import { CrewInvitationPreviewDto } from './dto/crew-invitation-preview.dto';
import { CrewItemResponseDto } from './dto/crew-item-response.dto';
import { CrewMemberResponseDto } from './dto/crew-member-response.dto';
import { GetCrewMembersQueryDto } from './dto/get-crew-members-query.dto';
import { GetCrewsQueryDto } from './dto/get-crews-query.dto';
import { JoinCrewDto } from './dto/join-crew.dto';
import { UpdateCrewDto } from './dto/update-crew.dto';
import { UpdateMemberAliasDto } from './dto/update-member-alias.dto';

@ApiTags('crews')
@ApiCookieAuth('access_token')
@Controller('crews')
@AuthRequired()
export class CrewsController {
  constructor(private readonly crewsService: CrewsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of user crews' })
  @ApiResponse({ status: 200, description: 'Paginated crews' })
  async getCrews(
    @CurrentUser('id') userId: number,
    @Query() query: GetCrewsQueryDto,
  ): Promise<PaginatedResponseDto<CrewItemResponseDto>> {
    return await this.crewsService.getCrews(userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new crew' })
  @ApiResponse({ status: 201, description: 'Crew created' })
  async createCrew(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateCrewDto,
  ): Promise<{ ok: true }> {
    return await this.crewsService.createCrew(userId, dto);
  }

  @Get('invitations/:code')
  @ApiOperation({ summary: 'Get crew invitation preview by invite code' })
  @ApiResponse({ status: 200, type: CrewInvitationPreviewDto })
  async getInvitationPreview(
    @CurrentUser('id') userId: number,
    @Param('code', new ParseUUIDPipe({ version: '4' })) code: string,
  ): Promise<CrewInvitationPreviewDto> {
    return await this.crewsService.getInvitationPreview(userId, code);
  }

  @Post('invitations/:code/join')
  @ApiOperation({ summary: 'Join crew by invitation code' })
  @ApiResponse({ status: 201, description: 'Joined crew successfully' })
  async joinCrewByInvite(
    @CurrentUser('id') userId: number,
    @Param('code', new ParseUUIDPipe({ version: '4' })) code: string,
    @Body() dto: JoinCrewDto,
  ): Promise<{ ok: true; crewId: number }> {
    return await this.crewsService.joinCrewByInvite(userId, code, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed crew information by crew ID' })
  @ApiResponse({ status: 200, type: CrewDetailResponseDto })
  async getCrewById(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CrewDetailResponseDto> {
    return await this.crewsService.getCrewById(userId, id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get paginated list of crew members' })
  @ApiResponse({ status: 200, description: 'Paginated crew members' })
  async getCrewMembers(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetCrewMembersQueryDto,
  ): Promise<PaginatedResponseDto<CrewMemberResponseDto>> {
    return await this.crewsService.getCrewMembers(userId, id, query);
  }

  @Post(':crewId/avatar')
  @ApiOperation({ summary: 'Upload crew avatar image (owner only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Avatar uploaded' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadCrewAvatar(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ ok: true }> {
    return await this.crewsService.uploadCrewAvatar(userId, crewId, file!);
  }

  @Post(':crewId/cover')
  @ApiOperation({ summary: 'Upload crew cover image (owner only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Cover uploaded' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadCrewCover(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ ok: true }> {
    return await this.crewsService.uploadCrewCover(userId, crewId, file!);
  }

  @Delete(':crewId/avatar')
  @ApiOperation({ summary: 'Delete crew avatar image (owner only)' })
  @ApiResponse({ status: 200, description: 'Avatar deleted' })
  async deleteCrewAvatar(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
  ): Promise<{ ok: true }> {
    return await this.crewsService.deleteCrewAvatar(userId, crewId);
  }

  @Delete(':crewId/cover')
  @ApiOperation({ summary: 'Delete crew cover image (owner only)' })
  @ApiResponse({ status: 200, description: 'Cover deleted' })
  async deleteCrewCover(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
  ): Promise<{ ok: true }> {
    return await this.crewsService.deleteCrewCover(userId, crewId);
  }

  @Put(':crewId/members/:memberId/alias')
  @ApiOperation({ summary: 'Update member alias in crew' })
  @ApiResponse({ status: 200, description: 'Member alias updated' })
  async updateMemberAlias(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: UpdateMemberAliasDto,
  ): Promise<{ ok: true }> {
    return await this.crewsService.updateMemberAlias(
      userId,
      crewId,
      memberId,
      dto,
    );
  }

  @Delete(':crewId/members/:memberId')
  @ApiOperation({ summary: 'Remove a member from crew or leave crew' })
  @ApiResponse({ status: 200, description: 'Member removed or left' })
  async removeMember(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ): Promise<{ ok: true }> {
    return await this.crewsService.removeMember(userId, crewId, memberId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update crew details (owner only)' })
  @ApiResponse({ status: 200, description: 'Crew updated' })
  async updateCrew(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCrewDto,
  ): Promise<{ ok: true }> {
    return await this.crewsService.updateCrew(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete crew (owner only)' })
  @ApiResponse({ status: 200, description: 'Crew deleted' })
  async deleteCrew(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ ok: true }> {
    return await this.crewsService.deleteCrew(userId, id);
  }
}
