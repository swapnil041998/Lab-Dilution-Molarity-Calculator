import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

function panel(page: Page, name: string) {
  return page.getByRole('tabpanel', { name, exact: true })
}

function tab(page: Page, name: string) {
  return page.getByRole('tab', { name, exact: true })
}

/**
 * No sideways scrolling. Compares with the device's own width: an emulated
 * phone widens its layout to fit content that is too wide, so the page's
 * own innerWidth would hide the problem.
 */
async function expectFitsScreen(page: Page) {
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  )
  expect(scrollWidth, 'no sideways scrolling').toBeLessThanOrEqual(
    page.viewportSize()!.width,
  )
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
  await tab(page, 'Dilution').click()
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

test('plans a tenfold serial dilution', async ({ page }) => {
  await page.goto('/')
  await tab(page, 'Serial dilution').click()
  const serial = panel(page, 'Serial dilution')
  await serial.getByRole('textbox', { name: 'Number of tubes' }).fill('6')
  await serial.getByRole('textbox', { name: 'Volume in each tube' }).fill('900')
  await serial.getByRole('textbox', { name: 'Stock concentration' }).fill('10')

  const result = serial.getByRole('region', { name: 'Result' })
  await expect(result).toContainText(
    'Transfer 100 µL into 900 µL of diluent in each tube',
  )
  const rows = result.getByRole('table', { name: 'Tubes' }).getByRole('row')
  await expect(rows).toHaveCount(7)
  await expect(rows.last()).toContainText('10 nM')
  await expectFitsScreen(page)
  await expectAccessible(page, '#panel-serial')
})

test('plans calibration standards through an intermediate', async ({
  page,
}) => {
  await page.goto('/#standards')
  const standards = panel(page, 'Calibration standards')
  await standards
    .getByRole('textbox', { name: 'Stock concentration' })
    .fill('1000')
  await standards
    .getByRole('combobox', { name: 'Standard concentrations unit' })
    .selectOption('ug/L')
  await standards
    .getByRole('textbox', { name: 'Standard concentrations' })
    .fill('0, 1, 5, 10, 50, 100')
  await standards
    .getByRole('textbox', { name: 'Volume of each standard' })
    .fill('100')

  const result = standards.getByRole('region', { name: 'Result' })
  await expect(result).toContainText('Make 6 standards of 100 mL')
  await expect(result.getByRole('list', { name: 'Steps' })).toContainText(
    'Make the intermediate standard',
  )
  await expect(
    result.getByRole('table', { name: 'Standards' }).getByRole('row'),
  ).toHaveCount(7)
  await expectFitsScreen(page)
  await expectAccessible(page, '#panel-standards')
})

test('makes a phosphate buffer and a Tris buffer', async ({ page }) => {
  await page.goto('/#buffer')
  const buffer = panel(page, 'Buffer')
  await buffer
    .getByRole('combobox', { name: 'Buffer system' })
    .selectOption('sodium-phosphate')
  await buffer.getByRole('textbox', { name: 'pH' }).fill('7.4')
  await buffer
    .getByRole('textbox', { name: 'Buffer concentration' })
    .fill('100')
  await buffer.getByRole('textbox', { name: 'Final volume' }).fill('500')
  const result = buffer.getByRole('region', { name: 'Result' })
  await expect(result).toContainText(
    'Weigh 1.389 g of sodium phosphate monobasic monohydrate',
  )
  await expect(result).toContainText('the pKa is 6.80')
  await expectFitsScreen(page)
  await expectAccessible(page, '#panel-buffer')

  await buffer
    .getByRole('combobox', { name: 'Buffer system' })
    .selectOption('tris')
  await expect(result).toContainText('of 1 M HCl')
  // pH 7.4 set at 25 °C: Tris reads about 0.6 higher at 4 °C
  await expect(result).toContainText(/reads about pH 7\.9\d\sat 4\s°C/)
  await expectAccessible(page, '#panel-buffer')
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

const TABS = [
  ['solid', 'From a solid'],
  ['dilution', 'Dilution'],
  ['serial', 'Serial dilution'],
  ['standards', 'Calibration standards'],
  ['liquid', 'Concentrated liquid'],
  ['buffer', 'Buffer'],
] as const

for (const [id, name] of TABS) {
  test(`${name} fits the screen and passes an accessibility scan`, async ({
    page,
  }) => {
    await page.goto(`/#${id}`)
    await page.getByRole('radio', { name: 'Learn' }).check()
    await expect(panel(page, name)).toBeVisible()

    await expectFitsScreen(page)

    await expectAccessible(page, `#panel-${id}`)
    await expectAccessible(page, 'header')
  })
}

test.describe('small phone', () => {
  test.use({
    viewport: { width: 320, height: 640 },
    isMobile: true,
    hasTouch: true,
  })

  for (const [id, name] of TABS) {
    test(`${name} fits a 320 px screen`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'phone', 'phone layout only')
      await page.goto(`/#${id}`)
      await page.getByRole('radio', { name: 'Learn' }).check()
      await expect(panel(page, name)).toBeVisible()
      await expectFitsScreen(page)
    })
  }

  test('a wide table scrolls inside the result, not the page', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'phone layout only')
    await page.goto('/#standards')
    const standards = panel(page, 'Calibration standards')
    await standards
      .getByRole('combobox', { name: 'Stock concentration unit' })
      .selectOption('mg/mL')
    await standards
      .getByRole('combobox', { name: 'Standard concentrations unit' })
      .selectOption('ug/mL')
    await standards
      .getByRole('textbox', { name: 'Stock concentration' })
      .fill('2')
    await standards
      .getByRole('textbox', { name: 'Standard concentrations' })
      .fill('0, 25, 125, 250, 500, 750, 1000, 1500, 2000')
    await standards
      .getByRole('textbox', { name: 'Volume of each standard' })
      .fill('1')
    await expect(
      standards.getByRole('columnheader', { name: 'Diluent' }),
    ).toBeVisible()
    await expectFitsScreen(page)
    await expectAccessible(page, '#panel-standards')
  })
})

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

    await tab(page, 'Concentrated liquid').click()
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
