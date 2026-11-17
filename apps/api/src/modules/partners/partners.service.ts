import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@aitvaras/database";
import {
  sortPartnerRoles,
  type CreatePartnerRequest,
  type Partner,
  type UpdatePartnerRequest,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { toPartner } from "./partner.mapper";

const withRoles = {
  roles: true,
} satisfies Prisma.BusinessPartnerInclude;

interface FieldError {
  path: string;
  message: string;
}

const DUPLICATE_IDENTIFICATION_MESSAGE =
  "Šioje šalyje jau yra partneris su tokiu įmonės kodu.";

function duplicateIdentificationError(): ConflictException {
  return new ConflictException({
    code: "PARTNER_DUPLICATE_IDENTIFICATION",
    message: DUPLICATE_IDENTIFICATION_MESSAGE,
    errors: [
      {
        path: "companyCode",
        message: DUPLICATE_IDENTIFICATION_MESSAGE,
      },
    ],
  });
}

function isUniqueViolation(caught: unknown): boolean {
  return (
    caught instanceof Prisma.PrismaClientKnownRequestError &&
    caught.code === "P2002"
  );
}

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  /** All partners, ordered deterministically by name (then id). */
  async list(): Promise<Partner[]> {
    const partners = await this.prisma.businessPartner.findMany({
      include: withRoles,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return partners.map(toPartner);
  }

  async get(id: string): Promise<Partner> {
    const partner = await this.prisma.businessPartner.findUnique({
      where: { id },
      include: withRoles,
    });
    if (!partner) {
      throw new NotFoundException("Partner not found");
    }
    return toPartner(partner);
  }

  async create(input: CreatePartnerRequest): Promise<Partner> {
    this.assertIdentification(input);
    await this.assertUnique(input.country, input.companyCode);

    try {
      const partner = await this.prisma.businessPartner.create({
        data: {
          name: input.name,
          companyCode: input.companyCode,
          vatCode: input.vatCode ?? null,
          address: input.address ?? null,
          country: input.country,
          contactPerson: input.contactPerson ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          notes: input.notes ?? null,
          active: input.active ?? true,
          roles: { create: sortPartnerRoles(input.roles).map((role) => ({ role })) },
        },
        include: withRoles,
      });
      return toPartner(partner);
    } catch (caught) {
      if (isUniqueViolation(caught)) {
        throw duplicateIdentificationError();
      }
      throw caught;
    }
  }

  async update(id: string, input: UpdatePartnerRequest): Promise<Partner> {
    const existing = await this.prisma.businessPartner.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Partner not found");
    }

    // Validate the *resulting* record, not just the supplied fields. A partial
    // update of an already identified partner stays valid; clearing/omitting a
    // required field never silently persists an incomplete company partner.
    const effective = {
      name: input.name ?? existing.name,
      country: input.country !== undefined ? input.country : existing.country,
      companyCode:
        input.companyCode !== undefined
          ? input.companyCode
          : existing.companyCode,
    };
    this.assertIdentification(effective);
    if (effective.country !== null && effective.companyCode !== null) {
      await this.assertUnique(effective.country, effective.companyCode, id);
    }

    const data: Prisma.BusinessPartnerUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.companyCode !== undefined) {
      data.companyCode = input.companyCode;
    }
    if (input.vatCode !== undefined) {
      data.vatCode = input.vatCode;
    }
    if (input.address !== undefined) {
      data.address = input.address;
    }
    if (input.country !== undefined) {
      data.country = input.country;
    }
    if (input.contactPerson !== undefined) {
      data.contactPerson = input.contactPerson;
    }
    if (input.phone !== undefined) {
      data.phone = input.phone;
    }
    if (input.email !== undefined) {
      data.email = input.email;
    }
    if (input.notes !== undefined) {
      data.notes = input.notes;
    }
    if (input.active !== undefined) {
      data.active = input.active;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (Object.keys(data).length > 0) {
          await tx.businessPartner.update({ where: { id }, data });
        }
        if (input.roles !== undefined) {
          const roles = sortPartnerRoles(input.roles);
          await tx.partnerRole.deleteMany({ where: { partnerId: id } });
          await tx.partnerRole.createMany({
            data: roles.map((role) => ({ partnerId: id, role })),
          });
        }
      });
    } catch (caught) {
      if (isUniqueViolation(caught)) {
        throw duplicateIdentificationError();
      }
      throw caught;
    }

    return this.get(id);
  }

  /**
   * A company partner always has a name, a country code and a registration
   * number. The model has no individual/natural-person flag today, so the same
   * rule applies to every partner.
   */
  private assertIdentification(input: {
    name: string;
    country: string | null;
    companyCode: string | null;
  }): void {
    const errors: FieldError[] = [];
    if (input.name.trim() === "") {
      errors.push({
        path: "name",
        message: "Įveskite partnerio pavadinimą.",
      });
    }
    if (input.country === null || input.country.trim() === "") {
      errors.push({ path: "country", message: "Pasirinkite šalį." });
    }
    if (input.companyCode === null || input.companyCode.trim() === "") {
      errors.push({ path: "companyCode", message: "Įveskite įmonės kodą." });
    }
    if (errors.length > 0) {
      throw new BadRequestException({
        code: "PARTNER_IDENTIFICATION_REQUIRED",
        message: "Patikrinkite partnerio identifikacinius duomenis.",
        errors,
      });
    }
  }

  /**
   * The combination `(country, companyCode)` must be unique. The same number in
   * a different country is allowed. The database unique index is the final
   * guard; this check returns a useful field error in the normal case.
   */
  private async assertUnique(
    country: string | null,
    companyCode: string | null,
    excludeId?: string,
  ): Promise<void> {
    if (country === null || companyCode === null) {
      return;
    }
    const duplicate = await this.prisma.businessPartner.findFirst({
      where: {
        country,
        companyCode,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw duplicateIdentificationError();
    }
  }
}
