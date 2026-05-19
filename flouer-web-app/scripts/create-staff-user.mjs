import crypto from "node:crypto"
import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"

dotenv.config()

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  printUsage()
  process.exit(0)
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")
  process.exit(1)
}

const email = readOption("email", args)
if (!email) {
  console.error("Missing required argument: --email")
  printUsage()
  process.exit(1)
}

const password = readOption("password", args) ?? generatePassword()
const fullName = readOption("fullName", args) ?? null
const role = readOption("role", args) ?? "cashier"
const createProfile = (readOption("skipProfile", args) ?? "false") !== "true"
const emailConfirm = (readOption("emailConfirm", args) ?? "true") !== "false"

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: emailConfirm,
  user_metadata: {
    full_name: fullName ?? undefined,
  },
  app_metadata: {
    role,
  },
})

if (createUserError || !createdUser.user) {
  console.error("Failed to create auth user:", createUserError?.message ?? "Unknown error")
  process.exit(1)
}

if (createProfile) {
  const profilePayload = {
    id: createdUser.user.id,
    email,
    full_name: fullName,
    role,
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" })

  if (profileError) {
    console.error("Auth user created, but profile upsert failed:", profileError.message)
    console.error("Create the profiles table first or run with --skipProfile=true.")
    process.exit(1)
  }
}

console.log("Superuser provisioning succeeded.")
console.log(`Email: ${email}`)
console.log(`Password: ${password}`)
console.log(`User ID: ${createdUser.user.id}`)
console.log(`Role: ${role}`)

function parseArgs(rawArgs) {
  const parsed = {}

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i]
    if (!arg.startsWith("--")) continue

    const withoutPrefix = arg.slice(2)
    const equalsIndex = withoutPrefix.indexOf("=")

    if (equalsIndex >= 0) {
      const key = withoutPrefix.slice(0, equalsIndex)
      const value = withoutPrefix.slice(equalsIndex + 1)
      parsed[key] = value || "true"
      continue
    }

    const key = withoutPrefix
    const next = rawArgs[i + 1]
    if (next && !next.startsWith("--")) {
      parsed[key] = next
      i += 1
      continue
    }

    parsed[key] = "true"
  }

  return parsed
}

function generatePassword() {
  return crypto.randomBytes(18).toString("base64url")
}

function printUsage() {
  console.log("Usage:")
  console.log("  npm run staff:create -- --email=owner@cookieshop.com --role=superuser --fullName=\"Store Owner\"")
  console.log("Optional flags:")
  console.log("  --password=CustomStrongPassword123!")
  console.log("  --emailConfirm=true|false (default: true)")
  console.log("  --skipProfile=true|false (default: false)")
}

function readOption(key, parsedArgs) {
  const npmConfigVariants = [
    `npm_config_${toSnakeCase(key)}`,
    `npm_config_${key.toLowerCase()}`,
  ]

  if (parsedArgs[key] !== undefined) return parsedArgs[key]
  if (parsedArgs[key.toLowerCase()] !== undefined) return parsedArgs[key.toLowerCase()]

  for (const envKey of npmConfigVariants) {
    const value = process.env[envKey]
    if (value !== undefined) return value
  }

  return undefined
}

function toSnakeCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase()
}
