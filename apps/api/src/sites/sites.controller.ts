import {
  Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

interface AuthedRequest {
  user: { userId: string; orgId: string };
}

@UseGuards(JwtAuthGuard)
@Controller('sites')
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  list(@Request() req: AuthedRequest) {
    return this.sites.list(req.user.orgId);
  }

  @Get(':id')
  get(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.sites.get(req.user.orgId, id);
  }

  @Post()
  create(@Request() req: AuthedRequest, @Body() dto: CreateSiteDto) {
    return this.sites.create(req.user.orgId, dto);
  }

  @Patch(':id')
  update(@Request() req: AuthedRequest, @Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.sites.update(req.user.orgId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.sites.remove(req.user.orgId, id);
  }
}
