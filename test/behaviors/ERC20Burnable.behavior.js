const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const { expect } = require('chai');

function shouldBehaveLikeERC20Burnable (owner, initialBalance, burner) {
  describe('advanced burn', function () {
    describe('when the given amount is not greater than balance of the sender', function () {
      context('for a zero amount', function () {
        shouldBurn(new BN(0));
      });

      context('for a non-zero amount', function () {
        shouldBurn(initialBalance.subn(1));
      });

      function shouldBurn (amount) {
        beforeEach(async function () {
          await this.token.mint(owner, initialBalance, { from: owner });
          ({ logs: this.logs } = await this.token.burn(amount, { from: owner }));
        });

        it('rejects a non owner account', async function () {
          await expectRevert(this.token.burn(new BN(0), { from: burner }),
            'Ownable: caller is not the owner');
        });

        it('burns the requested amount', async function () {
          expect(await this.token.balanceOf(owner)).to.be.bignumber.equal(initialBalance.sub(amount));
        });

        it('emits a transfer event', async function () {
          expectEvent.inLogs(this.logs, 'Transfer', {
            from: owner,
            to: ZERO_ADDRESS,
            value: amount,
          });
        });
      }
    });

    describe('when the given amount is greater than the balance of the sender', function () {
      const amount = initialBalance.addn(1);

      beforeEach(async function () {
        await this.token.mint(owner, initialBalance, { from: owner });
      });

      it('reverts', async function () {
        await expectRevert(this.token.burn(amount, { from: owner }),
          'ERC20: burn amount exceeds balance',
        );
      });
    });
  });

  describe('burnFrom', function () {
    describe('on success', function () {
      context('for a zero amount', function () {
        shouldBurnFrom(new BN(0));
      });

      context('for a non-zero amount', function () {
        shouldBurnFrom(initialBalance.subn(1));
      });

      function shouldBurnFrom (amount) {
        const originalAllowance = amount.muln(2);

        beforeEach(async function () {
          await this.token.mint(burner, initialBalance, { from: owner });

          await this.token.approve(owner, originalAllowance, { from: burner });
          const { logs } = await this.token.burnFrom(burner, amount, { from: owner });
          this.logs = logs;
        });

        it('rejects a non owner account', async function () {
          await expectRevert(this.token.burnFrom(burner, new BN(0), { from: burner }),
            'Ownable: caller is not the owner');
        });

        it('burns the requested amount', async function () {
          expect(await this.token.balanceOf(burner)).to.be.bignumber.equal(initialBalance.sub(amount));
        });

        it('decrements allowance', async function () {
          expect(await this.token.allowance(burner, owner)).to.be.bignumber.equal(originalAllowance.sub(amount));
        });

        it('emits a transfer event', async function () {
          expectEvent.inLogs(this.logs, 'Transfer', {
            from: burner,
            to: ZERO_ADDRESS,
            value: amount,
          });
        });
      }
    });

    describe('when the given amount is greater than the balance of the sender', function () {
      const amount = initialBalance.addn(1);

      beforeEach(async function () {
        await this.token.mint(burner, initialBalance, { from: owner });
      });

      it('reverts', async function () {
        await this.token.approve(owner, amount, { from: burner });
        await expectRevert(this.token.burnFrom(burner, amount, { from: owner }),
          'ERC20: burn amount exceeds balance',
        );
      });
    });

    describe('when the given amount is greater than the allowance', function () {
      const allowance = initialBalance.subn(1);

      beforeEach(async function () {
        await this.token.mint(burner, initialBalance, { from: owner });
      });

      it('reverts', async function () {
        await this.token.approve(owner, allowance, { from: burner });
        await expectRevert(this.token.burnFrom(burner, allowance.addn(1), { from: owner }),
          'ERC20: burn amount exceeds allowance',
        );
      });
    });
  });
}

module.exports = {
  shouldBehaveLikeERC20Burnable,
};
