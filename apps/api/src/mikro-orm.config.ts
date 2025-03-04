// Ce fichier peut être supprimé car il est remplacé par le DbService

import { DbService } from './modules/db/db.service';
import { ConfigService } from './modules/config/config.service';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { ConfigSchema } from 'src/modules/config/config.validation';

const config = ConfigService.loadConfig();
const nestConfigService = new NestConfigService(config);
const configService = new ConfigService(nestConfigService as unknown as NestConfigService<ConfigSchema, true>);
const dbService = new DbService(configService);

export default dbService.createMikroOrmOptions();
