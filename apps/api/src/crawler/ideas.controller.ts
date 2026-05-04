import { Body, Controller, Get, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IdeasService } from './ideas.service';
import { ListIdeasQueryDto } from './dto/list-ideas-query.dto';
import { PatchIdeaDto } from './dto/patch-idea.dto';

interface AuthedRequest {
  user: { userId: string; orgId: string };
}

@UseGuards(JwtAuthGuard)
@Controller('ideas')
export class IdeasController {
  constructor(private readonly ideas: IdeasService) {}

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
