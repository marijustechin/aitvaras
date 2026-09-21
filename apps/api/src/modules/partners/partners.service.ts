import { Injectable, NotFoundException } from "@nestjs/common";
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
    const partner = await this.prisma.businessPartner.create({
      data: {
        name: input.name,
        companyCode: input.companyCode ?? null,
        vatCode: input.vatCode ?? null,
        address: input.address ?? null,
        country: input.country ?? null,
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
  }

  async update(id: string, input: UpdatePartnerRequest): Promise<Partner> {
    const existing = await this.prisma.businessPartner.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Partner not found");
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

    return this.get(id);
  }
}
