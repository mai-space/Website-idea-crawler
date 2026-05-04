import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IdeasService } from './ideas.service';
import { ListIdeasQueryDto } from './dto/list-ideas-query.dto';
import { PatchIdeaDto } from './dto/patch-idea.dto';
import { BulkIdeasDto } from './dto/bulk-ideas.dto';

interface AuthedRequest {
  user: { userId: string; orgId: string };
}

@UseGuards(JwtAuthGuard)
@Controller('ideas')
export class IdeasController {
  constructor(private readonly ideas: IdeasService) {}

  @Get('stats')
  stats(@Request() req: AuthedRequest) {
    return this.ideas.getOrgStats(req.user.orgId);
  }

  @Post('bulk')
  bulk(@Request() req: AuthedRequest, @Body() dto: BulkIdeasDto) {
    return this.ideas.bulkSetStatus(req.user.orgId, dto);
  }

  @Get()
  listOrg(@Request() req: AuthedRequest, @Query() q: ListIdeasQueryDto) {
    return this.ideas.listForOrg(req.user.orgId, q);
  }

  @Get(':id')
  getOne(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.ideas.getDetail(req.user.orgId, id);
  }

  @Patch(':id')
  patch(@Request() req: AuthedRequest, @Param('id') id: string, @Body() dto: PatchIdeaDto) {
    return this.ideas.patch(req.user.orgId, id, dto);
  }
}
