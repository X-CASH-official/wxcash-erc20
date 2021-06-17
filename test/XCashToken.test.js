const { BN, constants, expectEvent, expectRevert, ether } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ZERO_ADDRESS } = constants;

const {
  shouldBehaveLikeERC20,
  shouldBehaveLikeERC20Transfer,
  shouldBehaveLikeERC20Approve,
} = require('./behaviors/ERC20.behavior');

const { shouldBehaveLikeERC20Capped } = require('./behaviors/ERC20Capped.behavior');

const { shouldBehaveLikeERC20Burnable } = require('./behaviors/ERC20Burnable.behavior');

const ERC20 = artifacts.require('XCashToken');

contract('XCashToken', function (accounts) {
  const [ initialHolder, recipient, anotherAccount ] = accounts;

  const name = 'X-Cash';
  const symbol = 'XCASH';
  const decimals = '18';

  const cap = ether('100000000000');

  const initialSupply = new BN(0);
  const supply = new BN(100);

  beforeEach(async function () {
    this.token = await ERC20.new();
  });

  it('has a name', async function () {
    expect(await this.token.name()).to.equal(name);
  });

  it('has a symbol', async function () {
    expect(await this.token.symbol()).to.equal(symbol);
  });

  it('has 18 decimals', async function () {
    expect(await this.token.decimals()).to.be.bignumber.equal(decimals);
  });

  describe('ownable token', function () {
    it('has an owner', async function () {
      expect(await this.token.owner()).to.equal(initialHolder);
    });

    describe('transfer ownership', function () {
      it('changes owner after transfer', async function () {
        const receipt = await this.token.transferOwnership(anotherAccount, { from: initialHolder });
        expectEvent(receipt, 'OwnershipTransferred');

        expect(await this.token.owner()).to.equal(anotherAccount);
      });

      it('prevents non-owners from transferring', async function () {
        await expectRevert(
          this.token.transferOwnership(anotherAccount, { from: anotherAccount }),
          'Ownable: caller is not the owner',
        );
      });

      it('guards ownership against stuck state', async function () {
        await expectRevert(
          this.token.transferOwnership(ZERO_ADDRESS, { from: initialHolder }),
          'Ownable: new owner is the zero address',
        );
      });
    });

    describe('renounce ownership', function () {
      it('loses owner after renouncement', async function () {
        const receipt = await this.token.renounceOwnership({ from: initialHolder });
        expectEvent(receipt, 'OwnershipTransferred');

        expect(await this.token.owner()).to.equal(ZERO_ADDRESS);
      });

      it('prevents non-owners from renouncement', async function () {
        await expectRevert(
          this.token.renounceOwnership({ from: anotherAccount }),
          'Ownable: caller is not the owner',
        );
      });
    });
  });

  shouldBehaveLikeERC20Capped(initialHolder, anotherAccount, cap);

  shouldBehaveLikeERC20('ERC20', supply, initialSupply, initialHolder, recipient, anotherAccount);


  describe('decrease allowance', function () {
    describe('when the spender is not the zero address', function () {
      const spender = recipient;

      function shouldDecreaseApproval (amount) {
        describe('when there was no approved amount before', function () {
          it('reverts', async function () {
            await expectRevert(this.token.decreaseAllowance(
              spender, amount, { from: initialHolder }), 'ERC20: decreased allowance below zero',
            );
          });
        });

        describe('when the spender had an approved amount', function () {
          const approvedAmount = amount;

          beforeEach(async function () {
            ({ logs: this.logs } = await this.token.approve(spender, approvedAmount, { from: initialHolder }));
          });

          it('emits an approval event', async function () {
            const { logs } = await this.token.decreaseAllowance(spender, approvedAmount, { from: initialHolder });

            expectEvent.inLogs(logs, 'Approval', {
              owner: initialHolder,
              spender: spender,
              value: new BN(0),
            });
          });

          it('decreases the spender allowance subtracting the requested amount', async function () {
            await this.token.decreaseAllowance(spender, approvedAmount.subn(1), { from: initialHolder });

            expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal('1');
          });

          it('sets the allowance to zero when all allowance is removed', async function () {
            await this.token.decreaseAllowance(spender, approvedAmount, { from: initialHolder });
            expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal('0');
          });

          it('reverts when more than the full allowance is removed', async function () {
            await expectRevert(
              this.token.decreaseAllowance(spender, approvedAmount.addn(1), { from: initialHolder }),
              'ERC20: decreased allowance below zero',
            );
          });
        });
      }

      describe('when the sender has enough balance', function () {
        const amount = supply;

        shouldDecreaseApproval(amount);
      });

      describe('when the sender does not have enough balance', function () {
        const amount = supply.addn(1);

        shouldDecreaseApproval(amount);
      });
    });

    describe('when the spender is the zero address', function () {
      const amount = supply;
      const spender = ZERO_ADDRESS;

      it('reverts', async function () {
        await expectRevert(this.token.decreaseAllowance(
          spender, amount, { from: initialHolder }), 'ERC20: decreased allowance below zero',
        );
      });
    });
  });

  describe('increase allowance', function () {
    const amount = supply;

    describe('when the spender is not the zero address', function () {
      const spender = recipient;

      describe('when the sender has enough balance', function () {
        it('emits an approval event', async function () {
          const { logs } = await this.token.increaseAllowance(spender, amount, { from: initialHolder });

          expectEvent.inLogs(logs, 'Approval', {
            owner: initialHolder,
            spender: spender,
            value: amount,
          });
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await this.token.increaseAllowance(spender, amount, { from: initialHolder });

            expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, new BN(1), { from: initialHolder });
          });

          it('increases the spender allowance adding the requested amount', async function () {
            await this.token.increaseAllowance(spender, amount, { from: initialHolder });

            expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount.addn(1));
          });
        });
      });

      describe('when the sender does not have enough balance', function () {
        const amount = supply.addn(1);

        it('emits an approval event', async function () {
          const { logs } = await this.token.increaseAllowance(spender, amount, { from: initialHolder });

          expectEvent.inLogs(logs, 'Approval', {
            owner: initialHolder,
            spender: spender,
            value: amount,
          });
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await this.token.increaseAllowance(spender, amount, { from: initialHolder });

            expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, new BN(1), { from: initialHolder });
          });

          it('increases the spender allowance adding the requested amount', async function () {
            await this.token.increaseAllowance(spender, amount, { from: initialHolder });

            expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount.addn(1));
          });
        });
      });
    });

    describe('when the spender is the zero address', function () {
      const spender = ZERO_ADDRESS;

      it('reverts', async function () {
        await expectRevert(
          this.token.increaseAllowance(spender, amount, { from: initialHolder }), 'ERC20: approve to the zero address',
        );
      });
    });
  });

  describe('mint', function () {
    const amount = new BN(50);
    it('rejects a null account', async function () {
      await expectRevert(
        this.token.mint(ZERO_ADDRESS, amount, { from: initialHolder }), 'ERC20: mint to the zero address',
      );
    });

    it('rejects for a non owner', async function () {
      await expectRevert(
        this.token.mint(recipient, amount, { from: recipient }), 'Ownable: caller is not the owner',
      );
    });

    describe('for a non zero account', function () {
      beforeEach('minting', async function () {
        const { logs } = await this.token.mint(recipient, amount, { from: initialHolder });
        this.logs = logs;
      });

      it('increments totalSupply', async function () {
        const expectedSupply = initialSupply.add(amount);
        expect(await this.token.totalSupply()).to.be.bignumber.equal(expectedSupply);
      });

      it('increments recipient balance', async function () {
        expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal(amount);
      });

      it('emits Transfer event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Transfer', {
          from: ZERO_ADDRESS,
          to: recipient,
        });

        expect(event.args.value).to.be.bignumber.equal(amount);
      });
    });
  });

  describe('burn', function () {
    it('rejects a non owner account', async function () {
      await expectRevert(this.token.burn(new BN(1), { from: anotherAccount }),
        'Ownable: caller is not the owner');
    });

    describe('for a non zero account', function () {
      it('rejects burning more than balance', async function () {
        await expectRevert(this.token.burn(
          supply.addn(1), { from: initialHolder }), 'ERC20: burn amount exceeds balance',
        );
      });

      const describeBurn = function (description, amount) {
        describe(description, function () {
          beforeEach('burning', async function () {
            await this.token.mint(initialHolder, supply, { from: initialHolder });
            const { logs } = await this.token.burn(amount, { from: initialHolder });
            this.logs = logs;
          });

          it('decrements totalSupply', async function () {
            const expectedSupply = supply.sub(amount);
            expect(await this.token.totalSupply()).to.be.bignumber.equal(expectedSupply);
          });

          it('decrements initialHolder balance', async function () {
            const expectedBalance = supply.sub(amount);
            expect(await this.token.balanceOf(initialHolder)).to.be.bignumber.equal(expectedBalance);
          });

          it('emits Transfer event', async function () {
            const event = expectEvent.inLogs(this.logs, 'Transfer', {
              from: initialHolder,
              to: ZERO_ADDRESS,
            });

            expect(event.args.value).to.be.bignumber.equal(amount);
          });
        });
      };

      describeBurn('for entire balance', supply);
      describeBurn('for less amount than balance', supply.subn(1));
    });
  });

  shouldBehaveLikeERC20Burnable(initialHolder, supply, anotherAccount);
});
