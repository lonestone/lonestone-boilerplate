
import { createParamDecorator, SetMetadata } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";

export const BEFORE_HOOK_KEY = Symbol("BEFORE_HOOK");
export const AFTER_HOOK_KEY = Symbol("AFTER_HOOK");
export const HOOK_KEY = Symbol("HOOK");

export const Public = () => SetMetadata("PUBLIC", true);
export const Optional = () => SetMetadata("OPTIONAL", true);

export const Session = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => {
		const request = context.switchToHttp().getRequest();
		return request.session;
	},
);

export const BeforeHook = (path: `/${string}`) =>
	SetMetadata(BEFORE_HOOK_KEY, path);

export const AfterHook = (path: `/${string}`) =>
	SetMetadata(AFTER_HOOK_KEY, path);

export const Hook = () => SetMetadata(HOOK_KEY, true);