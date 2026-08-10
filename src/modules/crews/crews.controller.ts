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
} from '@nestjs/common';
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

@Controller('crews')
@AuthRequired()
export class CrewsController {
  constructor(private readonly crewsService: CrewsService) {}

  @Get()
  async getCrews(
    @CurrentUser('id') userId: number,
    @Query() query: GetCrewsQueryDto,
  ): Promise<PaginatedResponseDto<CrewItemResponseDto>> {
    return await this.crewsService.getCrews(userId, query);
  }

  @Post()
  async createCrew(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateCrewDto,
  ): Promise<{ ok: true }> {
    return await this.crewsService.createCrew(userId, dto);
  }

  @Get('invitations/:code')
  async getInvitationPreview(
    @CurrentUser('id') userId: number,
    @Param('code', new ParseUUIDPipe({ version: '4' })) code: string,
  ): Promise<CrewInvitationPreviewDto> {
    return await this.crewsService.getInvitationPreview(userId, code);
  }

  @Post('invitations/:code/join')
  async joinCrewByInvite(
    @CurrentUser('id') userId: number,
    @Param('code', new ParseUUIDPipe({ version: '4' })) code: string,
    @Body() dto: JoinCrewDto,
  ): Promise<{ ok: true; crewId: number }> {
    return await this.crewsService.joinCrewByInvite(userId, code, dto);
  }

  @Get(':id')
  async getCrewById(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CrewDetailResponseDto> {
    return await this.crewsService.getCrewById(userId, id);
  }

  @Get(':id/members')
  async getCrewMembers(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetCrewMembersQueryDto,
  ): Promise<PaginatedResponseDto<CrewMemberResponseDto>> {
    return await this.crewsService.getCrewMembers(userId, id, query);
  }

  @Put(':crewId/members/:memberId/alias')
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
  async removeMember(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ): Promise<{ ok: true }> {
    return await this.crewsService.removeMember(userId, crewId, memberId);
  }

  @Patch(':id')
  async updateCrew(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCrewDto,
  ): Promise<{ ok: true }> {
    return await this.crewsService.updateCrew(userId, id, dto);
  }

  @Delete(':id')
  async deleteCrew(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ ok: true }> {
    return await this.crewsService.deleteCrew(userId, id);
  }
}
