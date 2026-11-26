import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { FIREBASE_AUTH } from '../auth/firebase-auth.constants';
import { ProfessoresModule } from './professores.module';
import { ProfessoresService } from './professores.service';

describe('ProfessoresController', () => {
  const listar = jest.fn();
  let app: INestApplication;

  beforeEach(async () => {
    listar
      .mockReset()
      .mockResolvedValue([
        { id: 'firebase-teacher-id', nome: 'Professora Exemplo' },
      ]);

    const moduleRef = await Test.createTestingModule({
      imports: [ProfessoresModule],
    })
      .overrideProvider(FIREBASE_AUTH)
      .useValue({})
      .overrideProvider(ProfessoresService)
      .useValue({ listar })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lista publicamente os professores disponíveis para seleção', async () => {
    await request(app.getHttpServer())
      .get('/professores')
      .expect(200)
      .expect([{ id: 'firebase-teacher-id', nome: 'Professora Exemplo' }]);

    expect(listar).toHaveBeenCalledTimes(1);
  });
});
