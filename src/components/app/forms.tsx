import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Field, Input, Select } from '@/components/ui';
import { COMPANY_SIZES, FACILITY_TYPES, INDIAN_STATES, INDUSTRIES, PRODUCTION_UNITS } from '@/lib/constants';
import type { FacilityInput, OrgInput } from '@/lib/data/actions';

const orgSchema = z.object({
  name: z.string().trim().min(2, 'Enter your organisation name.'),
  industry: z.string().min(1, 'Choose an industry.'),
  companySize: z.string().min(1, 'Choose a company size.'),
  country: z.string().trim().min(2, 'Enter a country.'),
  state: z.string().trim().min(2, 'Enter a state.'),
  city: z.string().trim().min(2, 'Enter a city.'),
  website: z.union([z.literal(''), z.string().trim().url('Enter a full URL, e.g. https://example.com')]),
});

function StateField({ country, error, register }: { country: string; error?: string; register: ReturnType<typeof useForm<any>>['register'] }) {
  return (
    <Field label="State" required error={error}>
      {(p) =>
        country === 'India' ? (
          <Select {...p} {...register('state')}>
            <option value="">Select a state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        ) : (
          <Input {...p} {...register('state')} />
        )
      }
    </Field>
  );
}

export function OrganizationForm({ defaultValues, submitLabel, onSubmit, disabled }: { defaultValues?: Partial<OrgInput>; submitLabel: string; onSubmit: (v: OrgInput) => void; disabled?: boolean }) {
  const { register, handleSubmit, watch, formState } = useForm<OrgInput>({
    resolver: zodResolver(orgSchema),
    defaultValues: { name: '', industry: '', companySize: '', country: 'India', state: '', city: '', website: '', ...defaultValues },
  });
  const e = formState.errors;
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <fieldset disabled={disabled} className="contents">
        <Field label="Organisation name" required error={e.name?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register('name')} />}
        </Field>
        <Field label="Industry / subsector" required error={e.industry?.message}>
          {(p) => (
            <Select {...p} {...register('industry')}>
              <option value="">Select an industry</option>
              {INDUSTRIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Company size" required error={e.companySize?.message}>
          {(p) => (
            <Select {...p} {...register('companySize')}>
              <option value="">Select size</option>
              {COMPANY_SIZES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Country" required error={e.country?.message}>
          {(p) => <Input {...p} {...register('country')} />}
        </Field>
        <StateField country={watch('country')} error={e.state?.message} register={register} />
        <Field label="City" required error={e.city?.message}>
          {(p) => <Input {...p} {...register('city')} />}
        </Field>
        <Field label="Business website" hint="Optional" error={e.website?.message}>
          {(p) => <Input type="url" placeholder="https://" {...p} {...register('website')} />}
        </Field>
        {!disabled && (
          <div className="sm:col-span-2">
            <Button type="submit">{submitLabel}</Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}

const facilitySchema = z.object({
  name: z.string().trim().min(2, 'Enter a facility name.'),
  address: z.string().trim().min(3, 'Enter an address.'),
  state: z.string().trim().min(2, 'Enter a state.'),
  city: z.string().trim().min(2, 'Enter a city.'),
  facilityType: z.string().min(1, 'Choose a facility type.'),
  industry: z.string(),
  productionUnit: z.string().min(1, 'Choose a production unit.'),
  annualCapacity: z.union([z.literal(''), z.coerce.number().positive('Must be greater than zero.')]),
});
type FacilityFormValues = z.input<typeof facilitySchema>;

export function FacilityForm({
  defaultValues,
  country = 'India',
  submitLabel,
  onSubmit,
  onCancel,
}: {
  defaultValues?: Partial<FacilityInput>;
  country?: string;
  submitLabel: string;
  onSubmit: (v: FacilityInput) => void;
  onCancel?: () => void;
}) {
  const { register, handleSubmit, formState } = useForm<FacilityFormValues>({
    resolver: zodResolver(facilitySchema),
    defaultValues: {
      name: '',
      address: '',
      state: '',
      city: '',
      facilityType: 'Manufacturing plant',
      industry: '',
      productionUnit: 'kg',
      ...defaultValues,
      annualCapacity: defaultValues?.annualCapacity ?? '',
    } as FacilityFormValues,
  });
  const e = formState.errors;
  return (
    <form
      onSubmit={handleSubmit((v) => {
        const parsed = facilitySchema.parse(v);
        onSubmit({ ...parsed, annualCapacity: parsed.annualCapacity === '' ? null : parsed.annualCapacity });
      })}
      className="grid gap-4 sm:grid-cols-2"
      noValidate
    >
      <Field label="Factory / facility name" required error={e.name?.message} className="sm:col-span-2">
        {(p) => <Input {...p} {...register('name')} />}
      </Field>
      <Field label="Address" required error={e.address?.message} className="sm:col-span-2">
        {(p) => <Input autoComplete="street-address" {...p} {...register('address')} />}
      </Field>
      <StateField country={country} error={e.state?.message} register={register as never} />
      <Field label="City" required error={e.city?.message}>
        {(p) => <Input {...p} {...register('city')} />}
      </Field>
      <Field label="Facility type" required error={e.facilityType?.message}>
        {(p) => (
          <Select {...p} {...register('facilityType')}>
            {FACILITY_TYPES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Production unit" required hint="Used to calculate emissions intensity." error={e.productionUnit?.message}>
        {(p) => (
          <Select {...p} {...register('productionUnit')}>
            {PRODUCTION_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Annual production capacity" hint="Optional, in the production unit above." error={e.annualCapacity?.message}>
        {(p) => <Input type="number" min="0" step="any" inputMode="decimal" {...p} {...register('annualCapacity')} />}
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit">{submitLabel}</Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
