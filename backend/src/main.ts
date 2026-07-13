import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const usersService = app.get(UsersService);
  try {
    const admin = await usersService.findByEmailWithPassword('admin@agrovenda.local');
    if (!admin) {
      await usersService.create({
        name: 'Administrador AgroVenda',
        email: 'admin@agrovenda.local',
        password: 'Admin123!',
        role: 'admin',
        active: true,
      });
      console.log('Auto-seeded default admin user: admin@agrovenda.local / Admin123!');
    }
  } catch (error) {
    console.error('Failed to auto-seed admin user:', error);
  }

  await app.listen(config.get<number>('PORT', 3001), '0.0.0.0');
}

void bootstrap();

