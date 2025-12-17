import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType({
  description: 'Cloudinary Signature',
})
export class CloudinarySignature {
  @Field(() => String, { description: 'Cloudinary Signature' })
  signature: string;

  @Field(() => Number, { description: 'Cloudinary Timestamp' })
  timestamp: number;

  @Field(() => String, { description: 'Cloudinary Cloud Name' })
  cloudName: string;

  @Field(() => String, { description: 'Cloudinary API Key' })
  apiKey: string;

  @Field(() => String, { description: 'Cloudinary Folder' })
  folder: string;
}
