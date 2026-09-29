import { Customer } from '../types.js';

/**
 * Checks whether a given customer is assigned to the specified broker or operator actor.
 * Strict ID-based match takes priority, followed by exact name match fallback.
 */
export function isBrokerAssigned(customer: Customer, actor: any): boolean {
  if (!actor || !customer) return false;

  // ID-based match takes absolute priority
  if (customer.assignedBrokerId) {
    return customer.assignedBrokerId === actor.id;
  }

  // Fallback to name matching only when assignedBrokerId is not set
  if (!customer.accountManager) return false;

  const actorName = (actor.name || '').trim();
  const brokerSimpleName = actorName.split(' (')[0].trim();
  const mgr = (customer.accountManager || '').trim();
  const mgrSimpleName = mgr.split(' (')[0].trim();

  // Guard against empty name bypass — empty string .includes('') is always true
  if (!brokerSimpleName || !mgrSimpleName) return false;

  // Strict equality only — no substring matching to prevent "Marco" matching "Gianmarco"
  return mgrSimpleName.toLowerCase() === brokerSimpleName.toLowerCase();
}

/**
 * Evaluates whether an authenticated actor has permission to access a customer's record
 * or associated documents (bills, readings, telemetry).
 */
export function canActorAccessCustomer(customer: Customer, actor: any): boolean {
  if (!actor || !customer) return false;

  // 1. Admin: full access across all customers
  if (actor.role === 'admin') {
    return true;
  }

  // 2. Broker / Operator: strictly assigned customers only
  if (actor.role === 'operator' || actor.role === 'broker') {
    return isBrokerAssigned(customer, actor);
  }

  // 3. Customer: strictly own record
  if (actor.role === 'customer') {
    return actor.id === customer.id || (actor.customerId && actor.customerId === customer.id);
  }

  // 4. Call Center: privacy preservation; call center operates on qualified leads
  return false;
}
