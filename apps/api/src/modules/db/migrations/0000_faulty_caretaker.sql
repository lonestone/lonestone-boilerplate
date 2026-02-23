CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" varchar(255) NOT NULL,
	"providerId" varchar(255) NOT NULL,
	"userId" uuid NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"ipAddress" varchar(255),
	"userAgent" text,
	"userId" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"postId" uuid NOT NULL,
	"userId" uuid,
	"content" text NOT NULL,
	"authorName" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"parentId" uuid
);
--> statement-breakpoint
CREATE TABLE "postVersion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"postId" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publishedAt" timestamp,
	"slug" varchar(255),
	CONSTRAINT "post_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_postId_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postVersion" ADD CONSTRAINT "postVersion_postId_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "comment_postId_idx" ON "comment" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "comment_userId_idx" ON "comment" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "comment_parentId_idx" ON "comment" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "postVersion_postId_idx" ON "postVersion" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "postVersion_title_idx" ON "postVersion" USING btree ("title");--> statement-breakpoint
CREATE INDEX "post_userId_idx" ON "post" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "post_publishedAt_idx" ON "post" USING btree ("publishedAt");--> statement-breakpoint
CREATE INDEX "post_slug_idx" ON "post" USING btree ("slug");