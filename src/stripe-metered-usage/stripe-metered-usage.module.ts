import { StripeModule } from '@golevelup/nestjs-stripe';
import {
  applyRawBodyOnlyTo,
  JsonBodyMiddleware,
  RawBodyMiddleware,
} from '@golevelup/nestjs-webhooks';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { StripeMeteredUsageController } from './stripe-metered-usage.controller';
import { StripeMeteredUsageService } from './stripe-metered-usage.service';
config();

@Module({
  imports: [
    JsonBodyMiddleware,
    RawBodyMiddleware,
    /* StripeModule.forRoot(StripeModule, {
      apiKey: process.env.STRIPE_API_KEY,
      webhookConfig: {
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      },
    }), */
    StripeModule.forRootAsync(StripeModule, {
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        apiKey: process.env.STRIPE_API_KEY,
        webhookConfig: {
          stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [StripeMeteredUsageController],
  providers: [StripeMeteredUsageService],
})
export class StripeMeteredUsageModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    applyRawBodyOnlyTo(consumer, {
      method: RequestMethod.ALL,
      path: 'stripe/webhook',
    });
  }
}