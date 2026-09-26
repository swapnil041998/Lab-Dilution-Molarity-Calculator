import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

function panel(page: Page, name: string) {
  return page.getByRole('tabpanel', { name })
}

/** Runs axe on part of the page and expects no violations at all. */
async function expectAccessible(page: Page, selector: string) {
  const scan = await new AxeBuilder({ page }).include(selector).analyze()
  expect(
    scan.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`),
  ).toEqual([])
}

test('makes 500 mL of 1 M NaCl from the solid', async ({ page }) => {
  await page.goto('/')
  const solid = panel(page, 'From a solid')
  await solid.getByRole('combobox', { name: 'Reagent' }).fill('NaCl')
  await page.getByRole('option', { name: /^Sodium chloride/ }).click()
  await solid.getByRole('textbox', { name: 'Concentration' }).fill('1')
  await solid.getByRole('textbox', { name: 'Final volume' }).fill('500')

  const result = solid.getByRole('region', { name: 'Result' })
  await expect(result).toContainText('Weigh 29.22 g')
  await expect(result).toContainText('A top-loading balance (0.01 g)')
  await expect(result.getByRole('list', { name: 'Steps' })).toContainText(
    'Dissolve it in about 400 mL of water',
  )
  await result.getByText('Show working').click()
  await expect(result).toContainText('500 mL = 0.5 L')
  await expectAccessible(page, '#panel-solid')
})

test('suggests a stock when the amount is too small to weigh', async ({
  page,
}) => {
  await page.goto('/')
  const solid = panel(page, 'From a solid')
  await solid.getByRole('combobox', { name: 'Reagent' }).fill('sodium azide')
  await page.getByRole('option', { name: /^Sodium azide/ }).click()
  await solid.getByRole('textbox', { name: 'Concentration' }).fill('0.1')
  await solid
    .getByRole('combobox', { name: 'Concentration unit' })
    .selectOption('mM')
  await solid.getByRole('textbox', { name: 'Final volume' }).fill('10')
  await expect(solid.getByRole('region', { name: 'Result' })).toContainText(
    'too little to weigh accurately',
  )
  // hazard (red) and warning (amber) banners are on screen
  await expectAccessible(page, '#panel-solid')
})

test('dilutes in two steps when the stock volume is too small', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('tab', { name: 'Dilution' }).click()
  const dilution = panel(page, 'Dilution')
  await dilution
    .getByRole('textbox', { name: 'Stock concentration (C1)' })
    .fill('10')
  await dilution
    .getByRole('textbox', { name: 'Final concentration (C2)' })
    .fill('10')
  await dilution
    .getByRole('combobox', { name: 'Final concentration (C2) unit' })
    .selectOption('nM')
  await dilution.getByRole('textbox', { name: 'Final volume (V2)' }).fill('10')

  const result = dilution.getByRole('region', { name: 'Result' })
  await expect(result).toContainText('too small to pipette accurately')
  await expect(result.getByRole('list', { name: 'Steps' })).toContainText(
    'Make the intermediate',
  )
  await expect(page).toHaveURL(/#dilution$/)
  await expectAccessible(page, '#panel-dilution')
})

test('dilutes 37% HCl, adding acid to water', async ({ page }) => {
  await page.goto('/#liquid')
  const liquid = panel(page, 'Concentrated liquid')
  await liquid.getByRole('combobox', { name: 'Reagent' }).fill('hydrochloric')
  await page.getByRole('option', { name: /Hydrochloric acid 37%/ }).click()
  await liquid
    .getByRole('textbox', { name: 'Concentration you want' })
    .fill('1')
  await liquid.getByRole('textbox', { name: 'Final volume' }).fill('1000')

  const result = liquid.getByRole('region', { name: 'Result' })
  await expect(result).toContainText('11.97 M')
  await expect(result).toContainText('Take 83.51 mL')
  await expect(result).toContainText('never water to the reagent')
  await expectAccessible(page, '#panel-liquid')
})

test('remembers Learn mode across visits', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('radio', { name: 'Learn' }).check()
  await expect(
    panel(page, 'From a solid').getByRole('complementary', {
      name: 'How it works',
    }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByRole('radio', { name: 'Learn' })).toBeChecked()
})

for (const [id, name] of [
  ['solid', 'From a solid'],
  ['dilution', 'Dilution'],
  ['liquid', 'Concentrated liquid'],
] as const) {
  test(`${name} fits the screen and passes an accessibility scan`, async ({
    page,
  }) => {
    await page.goto(`/#${id}`)
    await page.getByRole('radio', { name: 'Learn' }).check()
    await expect(panel(page, name)).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow, 'no sideways scrolling').toBeLessThanOrEqual(0)

    await expectAccessible(page, `#panel-${id}`)
    await expectAccessible(page, 'header')
  })
}

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' })

  test('results and warnings pass an accessibility scan', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('radio', { name: 'Learn' }).check()
    const solid = panel(page, 'From a solid')
    await solid.getByRole('combobox', { name: 'Reagent' }).fill('sodium azide')
    await page.getByRole('option', { name: /^Sodium azide/ }).click()
    await solid.getByRole('textbox', { name: 'Concentration' }).fill('0.1')
    await solid
      .getByRole('combobox', { name: 'Concentration unit' })
      .selectOption('mM')
    await solid.getByRole('textbox', { name: 'Final volume' }).fill('10')
    await expect(solid.getByRole('region', { name: 'Result' })).toContainText(
      'too little to weigh accurately',
    )
    await expectAccessible(page, 'body')

    await page.getByRole('tab', { name: 'Concentrated liquid' }).click()
    const liquid = panel(page, 'Concentrated liquid')
    await liquid.getByRole('combobox', { name: 'Reagent' }).fill('sulfuric')
    await page.getByRole('option', { name: /Sulfuric acid 98%/ }).click()
    await liquid
      .getByRole('textbox', { name: 'Concentration you want' })
      .fill('1')
    await liquid.getByRole('textbox', { name: 'Final volume' }).fill('500')
    await expect(liquid.getByRole('region', { name: 'Result' })).toContainText(
      'never water to the reagent',
    )
    await expectAccessible(page, '#panel-liquid')
  })
})
