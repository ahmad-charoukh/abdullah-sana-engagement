// Minimal structural binding types; avoids replacing browser DOM types with Worker globals.
interface InvitationD1Statement {
 bind(...args:(string|number|null)[]):InvitationD1Statement;
 first():Promise<Record<string,unknown>|null>;
 all():Promise<{results:Record<string,unknown>[]}>;
 run():Promise<unknown>;
}
interface CloudflareEnv {
 DB:{prepare(sql:string):InvitationD1Statement;batch(statements:InvitationD1Statement[]):Promise<unknown>};
 MEDIA:{put(key:string,value:Uint8Array,options:{httpMetadata:{contentType:string;cacheControl:string}}):Promise<unknown>;get(key:string):Promise<{arrayBuffer():Promise<ArrayBuffer>}|null>;delete(key:string):Promise<void>};
 ADMIN_USERNAME?:string;
 ADMIN_PASSWORD?:string;
 APP_URL?:string;
}
